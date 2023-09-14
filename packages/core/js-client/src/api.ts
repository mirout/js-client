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

import type { FnConfig, FunctionCallDef, ServiceDef } from '@fluencelabs/interfaces';
import type { IFluenceClient } from '@fluencelabs/interfaces';
import { getArgumentTypes } from '@fluencelabs/interfaces';
import { callAquaFunction, Fluence, registerService } from './index.js';
import { FluencePeer } from './jsPeer/FluencePeer.js';

export const isFluencePeer = (fluencePeerCandidate: unknown): fluencePeerCandidate is IFluenceClient => {
    return fluencePeerCandidate instanceof FluencePeer;
};

/**
 * Convenience function to support Aqua `func` generation backend
 * The compiler only need to generate a call the function and provide the corresponding definitions and the air script
 *
 * @param rawFnArgs - raw arguments passed by user to the generated function
 * @param def - function definition generated by the Aqua compiler
 * @param script - air script with function execution logic generated by the Aqua compiler
 */
export const v5_callFunction = async (
    rawFnArgs: Array<any>,
    def: FunctionCallDef,
    script: string,
): Promise<unknown> => {
    const { args, client: peer, config } = await extractFunctionArgs(rawFnArgs, def);
    
    return callAquaFunction({
        args,
        def,
        script,
        config: config || {},
        peer: peer,
    });
};

/**
 * Convenience function to support Aqua `service` generation backend
 * The compiler only need to generate a call the function and provide the corresponding definitions and the air script
 * @param args - raw arguments passed by user to the generated function
 * @param def - service definition generated by the Aqua compiler
 */
export const v5_registerService = async (args: any[], def: ServiceDef): Promise<unknown> => {
    const { peer, service, serviceId } = await extractServiceArgs(args, def.defaultServiceId);
    
    return registerService({
        def,
        service,
        serviceId,
        peer,
    });
};

/**
 * Arguments could be passed in one these configurations:
 * [...actualArgs]
 * [peer, ...actualArgs]
 * [...actualArgs, config]
 * [peer, ...actualArgs, config]
 *
 * This function select the appropriate configuration and returns
 * arguments in a structured way of: { peer, config, args }
 */
const extractFunctionArgs = async (
    args: any[],
    def: FunctionCallDef,
): Promise<{
    client: IFluenceClient;
    config?: FnConfig;
    args: { [key: string]: any };
}> => {
    const argumentTypes = getArgumentTypes(def);
    const argumentNames = Object.keys(argumentTypes);
    const numberOfExpectedArgs = argumentNames.length;

    let peer: IFluenceClient;
    let structuredArgs: any[];
    let config: FnConfig;
    if (isFluencePeer(args[0])) {
        peer = args[0];
        structuredArgs = args.slice(1, numberOfExpectedArgs + 1);
        config = args[numberOfExpectedArgs + 1];
    } else {
        if (!Fluence.defaultClient) {
            throw new Error(
                'Could not register Aqua service because the client is not initialized. Did you forget to call Fluence.connect()?',
            );
        }
        peer = Fluence.defaultClient;
        structuredArgs = args.slice(0, numberOfExpectedArgs);
        config = args[numberOfExpectedArgs];
    }

    if (structuredArgs.length !== numberOfExpectedArgs) {
        throw new Error(`Incorrect number of arguments. Expecting ${numberOfExpectedArgs}`);
    }

    const argsRes = argumentNames.reduce((acc, name, index) => ({ ...acc, [name]: structuredArgs[index] }), {});

    return {
        client: peer,
        config: config,
        args: argsRes,
    };
};

/**
 * Arguments could be passed in one these configurations:
 * [serviceObject]
 * [peer, serviceObject]
 * [defaultId, serviceObject]
 * [peer, defaultId, serviceObject]
 *
 * Where serviceObject is the raw object with function definitions passed by user
 *
 * This function select the appropriate configuration and returns
 * arguments in a structured way of: { peer, serviceId, service }
 */
const extractServiceArgs = async (
    args: any[],
    defaultServiceId?: string,
): Promise<{ peer: IFluenceClient; serviceId: string; service: any }> => {
    let peer: IFluenceClient;
    let serviceId: any;
    let service: any;
    if (isFluencePeer(args[0])) {
        peer = args[0];
    } else {
        if (!Fluence.defaultClient) {
            throw new Error(
                'Could not register Aqua service because the client is not initialized. Did you forget to call Fluence.connect()?',
            );
        }
        peer = Fluence.defaultClient;
    }

    if (typeof args[0] === 'string') {
        serviceId = args[0];
    } else if (typeof args[1] === 'string') {
        serviceId = args[1];
    } else {
        serviceId = defaultServiceId;
    }

    // Figuring out which overload is the service.
    // If the first argument is not Fluence Peer and it is an object, then it can only be the service def
    // If the first argument is peer, we are checking further. The second argument might either be
    // an object, that it must be the service object
    // or a string, which is the service id. In that case the service is the third argument
    if (!isFluencePeer(args[0]) && typeof args[0] === 'object') {
        service = args[0];
    } else if (typeof args[1] === 'object') {
        service = args[1];
    } else {
        service = args[2];
    }

    return {
        peer: peer,
        serviceId: serviceId,
        service: service,
    };
};