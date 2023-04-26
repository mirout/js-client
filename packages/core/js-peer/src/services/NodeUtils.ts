/*
 * Copyright 2023 Fluence Labs Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { CallParams, IFluenceInternalApi } from '@fluencelabs/interfaces';
import { defaultGuard } from './SingleModuleSrv.js';
import { NodeUtilsDef, registerNodeUtils } from './_aqua/node-utils.js';
import { SecurityGuard } from './securityGuard.js';
import { readFile } from 'fs/promises';
import { FluencePeer } from '../jsPeer/FluencePeer.js';

export class NodeUtils implements NodeUtilsDef {
    constructor(private peer: FluencePeer) {
        this.securityGuard_readFile = defaultGuard(this.peer);
    }

    securityGuard_readFile: SecurityGuard<'path'>;

    async read_file(path: string, callParams: CallParams<'path'>) {
        if (!this.securityGuard_readFile(callParams)) {
            return {
                success: false,
                error: 'Security guard validation failed',
                content: null,
            };
        }

        try {
            // Strange enough, but Buffer type works here, while reading with encoding 'utf-8' doesn't
            const data: any = await readFile(path);
            return {
                success: true,
                content: data,
                error: null,
            };
        } catch (err: any) {
            return {
                success: false,
                error: err.message,
                content: null,
            };
        }
    }
}

// HACK:: security guard functions must be ported to user API
export const doRegisterNodeUtils = (peer: any) => {
    registerNodeUtils(peer, 'node_utils', new NodeUtils(peer));
};