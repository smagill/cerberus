/*
 * Copyright (c) 2017 Nike, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.nike.cerberus.service;

import com.nike.backstopper.exception.ApiException;
import com.nike.cerberus.PrincipalType;
import com.nike.cerberus.dao.AuthTokenDao;
import com.nike.cerberus.domain.AuthTokenInfo;
import com.nike.cerberus.domain.AuthTokenType;
import com.nike.cerberus.domain.CerberusAuthToken;
import com.nike.cerberus.error.DefaultApiError;
import com.nike.cerberus.jwt.CerberusJwtClaims;
import com.nike.cerberus.record.AuthTokenRecord;
import com.nike.cerberus.security.CerberusPrincipal;
import com.nike.cerberus.util.AuthTokenGenerator;
import com.nike.cerberus.util.DateTimeSupplier;
import com.nike.cerberus.util.TokenHasher;
import com.nike.cerberus.util.UuidSupplier;
import org.apache.commons.lang3.StringUtils;
import org.mybatis.guice.transactional.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;
import javax.inject.Singleton;
import java.time.OffsetDateTime;
import java.util.Optional;

import static com.google.common.base.Preconditions.checkArgument;
import static org.mybatis.guice.transactional.Isolation.READ_UNCOMMITTED;

/**
 * Service for handling authentication tokens.
 */
@Singleton
public class AuthTokenService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final UuidSupplier uuidSupplier;
    private final TokenHasher tokenHasher;
    private final AuthTokenGenerator authTokenGenerator;
    private final AuthTokenDao authTokenDao;
    private final DateTimeSupplier dateTimeSupplier;
    private final JwtService jwtService;
    private final AuthTokenType issueType = AuthTokenType.SESSION;
    private final AuthTokenType acceptType = AuthTokenType.ALL;

    @Inject
    public AuthTokenService(UuidSupplier uuidSupplier,
                            TokenHasher tokenHasher,
                            AuthTokenGenerator authTokenGenerator,
                            AuthTokenDao authTokenDao,
                            DateTimeSupplier dateTimeSupplier,
                            JwtService jwtService) {

        this.uuidSupplier = uuidSupplier;
        this.tokenHasher = tokenHasher;
        this.authTokenGenerator = authTokenGenerator;
        this.authTokenDao = authTokenDao;
        this.dateTimeSupplier = dateTimeSupplier;
        this.jwtService = jwtService;
    }

    public CerberusAuthToken generateToken(String principal,
                                           PrincipalType principalType,
                                           boolean isAdmin,
                                           String groups,
                                           long ttlInMinutes,
                                           int refreshCount) {

        checkArgument(StringUtils.isNotBlank(principal), "The principal must be set and not empty");

        String id = uuidSupplier.get();
        OffsetDateTime now = dateTimeSupplier.get();

        String token;
        AuthTokenInfo authTokenInfo;

        switch (issueType) {
            case JWT:
                authTokenInfo = new CerberusJwtClaims()
                        .setId(id)
                        .setCreatedTs(now)
                        .setExpiresTs(now.plusMinutes(ttlInMinutes))
                        .setPrincipal(principal)
                        .setPrincipalType(principalType.getName())
                        .setIsAdmin(isAdmin)
                        .setGroups(groups)
                        .setRefreshCount(refreshCount);
                token = jwtService.generateJwtToken((CerberusJwtClaims) authTokenInfo);
                break;
            case SESSION:
                token = authTokenGenerator.generateSecureToken();
                authTokenInfo = new AuthTokenRecord()
                        .setId(id)
                        .setTokenHash(tokenHasher.hashToken(token))
                        .setCreatedTs(now)
                        .setExpiresTs(now.plusMinutes(ttlInMinutes))
                        .setPrincipal(principal)
                        .setPrincipalType(principalType.getName())
                        .setIsAdmin(isAdmin)
                        .setGroups(groups)
                        .setRefreshCount(refreshCount);
                authTokenDao.createAuthToken((AuthTokenRecord) authTokenInfo);
                break;
            case ALL:
            default:
                throw ApiException.newBuilder()
                        .withApiErrors(DefaultApiError.INTERNAL_SERVER_ERROR)
                        .build();
        }

        return getCerberusAuthTokenFromRecord(token, authTokenInfo);
    }

    private CerberusAuthToken getCerberusAuthTokenFromRecord(String token, AuthTokenInfo authTokenInfo) {
        return CerberusAuthToken.Builder.create()
                .withToken(token)
                .withCreated(authTokenInfo.getCreatedTs())
                .withExpires(authTokenInfo.getExpiresTs())
                .withPrincipal(authTokenInfo.getPrincipal())
                .withPrincipalType(PrincipalType.fromName(authTokenInfo.getPrincipalType()))
                .withIsAdmin(authTokenInfo.getIsAdmin())
                .withGroups(authTokenInfo.getGroups())
                .withRefreshCount(authTokenInfo.getRefreshCount())
                .withId(authTokenInfo.getId())
                .build();
    }

    public Optional<CerberusAuthToken> getCerberusAuthToken(String token) {
        Optional<? extends AuthTokenInfo> tokenRecord = Optional.empty();
        switch (acceptType) {
            case JWT:
                tokenRecord = jwtService.parseAndValidateToken(token);
                break;
            case SESSION:
                tokenRecord = authTokenDao.getAuthTokenFromHash(tokenHasher.hashToken(token));
                break;
            case ALL:
                if (jwtService.isJwt(token)) {
                    tokenRecord = jwtService.parseAndValidateToken(token);
                } else {
                    tokenRecord = authTokenDao.getAuthTokenFromHash(tokenHasher.hashToken(token));
                }
                break;
        }

        OffsetDateTime now = OffsetDateTime.now();
        if (tokenRecord.isPresent() && tokenRecord.get().getExpiresTs().isBefore(now)) {
            logger.warn("Returning empty optional, because token was expired, expired: {}, now: {}", tokenRecord.get().getExpiresTs(), now);
            return Optional.empty();
        }

        return tokenRecord.map(authTokenRecord -> getCerberusAuthTokenFromRecord(token, authTokenRecord));
    }

    @Transactional
    public void revokeToken(CerberusPrincipal cerberusPrincipal, OffsetDateTime tokenExpires) {
        switch (acceptType) {
            case JWT:
                logger.info("Revoking token ID: {}", cerberusPrincipal);
                jwtService.revokeToken(cerberusPrincipal.getTokenId(), tokenExpires);
                break;
            case SESSION:
                String hash = tokenHasher.hashToken(cerberusPrincipal.getToken());
                authTokenDao.deleteAuthTokenFromHash(hash);
                break;
            case ALL:
                if (jwtService.isJwt(cerberusPrincipal.getToken())) {
                    logger.info("Revoking token ID: {}", cerberusPrincipal);
                    jwtService.revokeToken(cerberusPrincipal.getTokenId(), tokenExpires);
                } else {
                    hash = tokenHasher.hashToken(cerberusPrincipal.getToken());
                    authTokenDao.deleteAuthTokenFromHash(hash);
                }
                break;
        }
    }

    @Transactional(
            isolation = READ_UNCOMMITTED, // allow dirty reads so we don't block other threads
            autoCommit = true // auto commit each batched / chunked delete
    )
    public int deleteExpiredTokens(int maxDelete, int batchSize, int batchPauseTimeInMillis) {
        return authTokenDao.deleteExpiredTokens(maxDelete, batchSize, batchPauseTimeInMillis);
    }
}
