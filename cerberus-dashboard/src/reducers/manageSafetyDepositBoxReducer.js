/*
 * Copyright (c) 2020 Nike, inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createReducer } from '../utils';
import * as action from '../constants/actions';

const initialState = {
    hasFetchedSDBData: false,
    hasFetchedObjectKeys: false,
    hasFetchedFileKeys: false,
    data: {},
    navigatedPath: null,
    keysForSecureDataPath: {},
    isFileSelected: false,
    secureData: {},
    secureFileData: {},
    displayPermissions: false,
    showAddSecretForm: false,
    showAddFileForm: false,
    isEditSubmitting: false,
    nav: {
        secureDataSelected: true,
        secureDataVersionsSelected: false,
        sdbSettingsSelected: false
    }
};

export default createReducer(initialState, {
    [action.STORE_SDB_DATA]: (state, payload) => {
        return Object.assign({}, state, {
            data: payload,
            hasFetchedSDBData: true,
            navigatedPath: payload.path
        });
    },
    [action.TOGGLE_PERM_VIS]: (state) => {
        return Object.assign({}, state, {
            displayPermissions: !state.displayPermissions
        });
    },
    [action.FETCHED_SECURE_DATA_KEYS]: (state, payload) => {
        let updatedKeys = state.keysForSecureDataPath;
        payload.forEach((key) =>
            updatedKeys[key] = { type: 'object' }
        );

        return Object.assign({}, state, {
            hasFetchedObjectKeys: true,
            keysForSecureDataPath: updatedKeys,
        });
    },
    [action.FETCHED_SECURE_FILE_KEYS]: (state, payload) => {
        let updatedKeys = state.keysForSecureDataPath;
        const navigatedPathComponentCount = state.navigatedPath.split("/").length;
        payload.forEach((key) => {
            // For example let's say navigatedPath = "app/sdb/" and the file structure looks like this:
            //
            // app/sdb
            //   |--file1.txt          filePath = "sdb/file1.txt"
            //   |--folder
            //        |--file2.txt     filePath = "sdb/folder/file2.txt"
            //
            // navigatedPath has 3 components ["app", "sdb", ""]
            // file1.txt has 2 components ["sdb", "file1.txt"] because no category
            // file2.txt has 3 components ["sdb", "folder", "file2.txt"]
            // So file in the current folder level would have fewer components than navigatedPath
            const filePathComponents = key.split("/");
            if (filePathComponents.length > navigatedPathComponentCount - 1) {
                const subPath = filePathComponents[navigatedPathComponentCount - 2];
                updatedKeys[subPath + "/"] = { type: 'object' };
            } else {
                updatedKeys[filePathComponents[filePathComponents.length - 1]] = { type: 'file' };
            }
        });

        return Object.assign({}, state, {
            hasFetchedFileKeys: true,
            keysForSecureDataPath: updatedKeys,
        });
    },
    [action.ADD_SECURE_DATA_KEY_IF_NOT_PRESET]: (state, payload) => {
        let existingKeysMap = state.keysForSecureDataPath;
        let keyToAdd = payload;
        let newKeyMap = {};
        let isKeyPreset = false;

        Object.keys(existingKeysMap).forEach((existingKey) => {
            if (existingKey === keyToAdd) {
                isKeyPreset = true;
            }
            newKeyMap[existingKey] = existingKeysMap[existingKey];
        });

        if (!isKeyPreset) {
            newKeyMap[keyToAdd] = { type: 'object' };
        }

        return Object.assign({}, state, {
            keysForSecureDataPath: newKeyMap
        });
    },
    [action.ADD_SECURE_FILE_KEY_IF_NOT_PRESET]: (state, payload) => {
        let existingKeysMap = state.keysForSecureDataPath;
        let keyToAdd = payload;
        let newKeyMap = {};
        let isKeyPreset = false;

        Object.keys(existingKeysMap).forEach((existingKey) => {
            if (existingKey === keyToAdd) {
                isKeyPreset = true;
            }
            newKeyMap[existingKey] = existingKeysMap[existingKey];
        });

        if (!isKeyPreset) {
            newKeyMap[keyToAdd] = { type: 'file' };
        }

        return Object.assign({}, state, {
            keysForSecureDataPath: newKeyMap
        });
    },
    [action.REMOVE_KEY_FOR_SECURE_DATA_FROM_LOCAL_STORE]: (state, payload) => {
        let existingMap = state.keysForSecureDataPath;
        let newMap = {};
        let keyToRemove = payload;

        Object.keys(existingMap).forEach((key) => {
            if (key !== keyToRemove) {
                newMap[key] = existingMap[key];
            }
        });

        return Object.assign({}, state, {
            keysForSecureDataPath: newMap
        });
    },
    [action.REMOVE_KEY_FOR_SECURE_FILE_FROM_LOCAL_STORE]: (state, payload) => {
        let existingMap = state.keysForSecureDataPath;
        let newMap = {};
        let keyToRemove = payload;

        Object.keys(existingMap).forEach((key) => {
            if (key !== keyToRemove) {
                newMap[key] = existingMap[key];
            }
        });

        return Object.assign({}, state, {
            keysForSecureDataPath: newMap
        });
    },
    [action.FETCHING_SECURE_OBJECT_KEYS]: (state) => {
        return Object.assign({}, state, {
            hasFetchedObjectKeys: false
        });
    },
    [action.FETCHING_SECURE_FILE_KEYS]: (state) => {
        return Object.assign({}, state, {
            hasFetchedFileKeys: false
        });
    },
    [action.UPDATE_NAVIGATED_PATH]: (state, payload) => {
        return Object.assign({}, state, {
            navigatedPath: payload,
            hasFetchedObjectKeys: false,
            hasFetchedFileKeys: false,
            keysForSecureDataPath: {},
        });
    },
    [action.FETCHING_SECURE_DATA]: (state, payload) => {
        let existingMap = state.secureData;
        let newMap = {};
        let fetchingKey = payload;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }
        newMap[fetchingKey] = {
            isFetching: true,
            isUpdating: false,
            isActive: true,
            data: {}
        };

        return Object.assign({}, state, {
            secureData: newMap
        });
    },
    [action.FETCHING_SECURE_FILE_DATA]: (state, payload) => {
        let existingMap = state.secureFileData;
        let newMap = {};
        let fetchingKey = payload;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }
        newMap[fetchingKey] = {
            isFetching: true,
            isUpdating: false,
            isActive: true,
            data: {}
        };

        return Object.assign({}, state, {
            secureFileData: newMap
        });
    },
    [action.FETCHED_SECURE_DATA]: (state, payload) => {
        let existingMap = state.secureData;
        let newMap = {};
        let fetchedKey = payload.key;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }

        newMap[fetchedKey] = {
            isFetching: false,
            isUpdating: false,
            isActive: true,
            data: payload.data
        };

        return Object.assign({}, state, {
            secureData: newMap
        });
    },
    [action.FETCHED_SECURE_FILE_DATA]: (state, payload) => {
        let existingMap = state.secureFileData;
        let newMap = {};
        let fetchedKey = payload.key;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }

        newMap[fetchedKey] = {
            isFetching: false,
            isUpdating: false,
            isActive: true,
            data: {
                "sizeInBytes": payload.sizeInBytes
            }
        };

        return Object.assign({}, state, {
            secureFileData: newMap
        });
    },
    [action.REMOVE_SECRET_FROM_LOCAL_STORE]: (state, payload) => {
        let existingMap = state.secureData;
        let newMap = new Map();

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key) && key !== payload) {
                newMap[key] = existingMap[key];
            }
        }

        return Object.assign({}, state, {
            secureData: newMap
        });
    },
    [action.REMOVE_FILE_FROM_LOCAL_STORE]: (state, payload) => {
        let existingMap = state.secureFileData;
        let newMap = new Map();

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key) && key !== payload) {
                newMap[key] = existingMap[key];
            }
        }

        return Object.assign({}, state, {
            secureFileData: newMap
        });
    },
    [action.SHOW_ADD_SECRET_FORM]: (state) => {
        return Object.assign({}, state, {
            showAddSecretForm: true
        });
    },
    [action.HIDE_ADD_SECRET_FORM]: (state) => {
        return Object.assign({}, state, {
            showAddSecretForm: false
        });
    },
    [action.SHOW_ADD_FILE_FORM]: (state) => {
        return Object.assign({}, state, {
            showAddFileForm: true
        });
    },
    [action.HIDE_ADD_FILE_FORM]: (state) => {
        return Object.assign({}, state, {
            showAddFileForm: false,
            isFileSelected: false,
        });
    },
    [action.SUBMITTING_EDIT_SDB_REQUEST]: (state) => {
        return Object.assign({}, state, {
            isEditSubmitting: true
        });
    },
    [action.RESET_SUBMITTING_EDIT_SDB_REQUEST]: (state) => {
        return Object.assign({}, state, {
            isEditSubmitting: false
        });
    },
    [action.CLEAR_SECURE_DATA]: (state) => {
        return Object.assign({}, state, {
            keysForSecureDataPath: {},
            secureData: {}
        });
    },
    [action.SAVING_SECURE_DATA]: (state, payload) => {
        let existingMap = state.secureData;
        let newMap = {};
        let fetchingKey = payload.path;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }
        newMap[fetchingKey] = {
            isFetching: false,
            isUpdating: true,
            isActive: true,
            data: existingMap[fetchingKey] ? existingMap[fetchingKey]['data'] : {}
        };

        return Object.assign({}, state, {
            secureData: newMap
        });
    },
    [action.SAVING_SECURE_FILE_DATA]: (state, payload) => {
        let existingMap = state.secureFileData;
        let newMap = {};
        let fetchingKey = payload.path;

        for (let key in existingMap) {
            if (existingMap.hasOwnProperty(key)) {
                newMap[key] = existingMap[key];
            }
        }
        newMap[fetchingKey] = {
            isFetching: false,
            isUpdating: true,
            isActive: true,
            data: existingMap[fetchingKey] ? existingMap[fetchingKey]['data'] : {}
        };

        return Object.assign({}, state, {
            secureFileData: newMap
        });
    },
    [action.RESET_SDB_DATA]: () => {
        return initialState;
    },
    [action.SDB_NAV_ITEM_SELECT]: (state, payload) => {
        let navMap = {
            secureDataSelected: false,
            secureDataVersionsSelected: false,
            sdbSettingsSelected: false
        };
        navMap[payload + 'Selected'] = true;
        return Object.assign({}, state, {
            nav: navMap
        });
    },
    [action.SECURE_FILE_SELECTED]: (state) => {
        return Object.assign({}, state, {
            isFileSelected: true
        });
    },
    [action.SECURE_FILE_UPLOADED]: (state) => {
        return Object.assign({}, state, {
            isFileSelected: false
        });
    }
});
