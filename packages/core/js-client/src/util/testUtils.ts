/**
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

import { promises as fs } from "fs";

import * as api from "@fluencelabs/aqua-api/aqua-api.js";
import {
  ClientConfig,
  FunctionCallDef,
  JSONArray,
  PassedArgs,
  RelayOptions,
  ServiceDef,
} from "@fluencelabs/interfaces";
import { Subject, Subscribable } from "rxjs";

import { ClientPeer, makeClientPeerConfig } from "../clientPeer/ClientPeer.js";
import { callAquaFunction } from "../compilerSupport/callFunction.js";
import { IConnection } from "../connection/interfaces.js";
import { DEFAULT_CONFIG, FluencePeer } from "../jsPeer/FluencePeer.js";
import { CallServiceResultType } from "../jsServiceHost/interfaces.js";
import { JsServiceHost } from "../jsServiceHost/JsServiceHost.js";
import { WrapFnIntoServiceCall } from "../jsServiceHost/serviceUtils.js";
import { KeyPair } from "../keypair/index.js";
import { WasmLoaderFromNpm } from "../marine/deps-loader/node.js";
import { MarineBackgroundRunner } from "../marine/worker/index.js";
import { WorkerLoader } from "../marine/worker-script/workerLoader.js";
import { Particle } from "../particle/Particle.js";

export const registerHandlersHelper = (
  peer: FluencePeer,
  particle: Particle,
  handlers: Record<
    string,
    Record<string, (args: JSONArray) => CallServiceResultType | undefined>
  >,
) => {
  Object.entries(handlers).forEach(([serviceId, service]) => {
    Object.entries(service).forEach(([fnName, fn]) => {
      peer.internals.regHandler.forParticle(
        particle.id,
        serviceId,
        fnName,
        WrapFnIntoServiceCall(fn),
      );
    });
  });
};

export type CompiledFnCall = (
  peer: FluencePeer,
  args: PassedArgs,
) => Promise<unknown>;
export type CompiledFile = {
  functions: { [key: string]: CompiledFnCall };
  services: { [key: string]: ServiceDef };
};

export const compileAqua = async (aquaFile: string): Promise<CompiledFile> => {
  await fs.access(aquaFile);

  const compilationResult = await api.Aqua.compile(
    new api.Path(aquaFile),
    [],
    undefined,
  );

  if (compilationResult.errors.length > 0) {
    throw new Error(
      "Aqua compilation failed. Error: " + compilationResult.errors.join("/n"),
    );
  }

  const functions = Object.entries(compilationResult.functions)
    .map(([name, fnInfo]) => {
      const callFn = (peer: FluencePeer, args: PassedArgs) => {
        return callAquaFunction({
          // TODO: Set our compiler here and fix this
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          def: fnInfo.funcDef as FunctionCallDef,
          script: fnInfo.script,
          config: {},
          peer: peer,
          args,
        });
      };

      return { [name]: callFn };
    })
    .reduce((agg, obj) => {
      return { ...agg, ...obj };
    }, {});

  return {
    functions,
    // TODO: set our compiler here and fix this
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    services: compilationResult.services as Record<string, ServiceDef>,
  };
};

class NoopConnection implements IConnection {
  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  getRelayPeerId(): string {
    return "nothing_here";
  }
  supportsRelay(): boolean {
    return true;
  }
  particleSource: Subscribable<Particle> = new Subject<Particle>();

  sendParticle(): Promise<void> {
    return Promise.resolve();
  }
}

export class TestPeer extends FluencePeer {
  constructor(keyPair: KeyPair, connection: IConnection) {
    const workerLoader = new WorkerLoader();

    const controlModuleLoader = new WasmLoaderFromNpm(
      "@fluencelabs/marine-js",
      "marine-js.wasm",
    );

    const avmModuleLoader = new WasmLoaderFromNpm(
      "@fluencelabs/avm",
      "avm.wasm",
    );

    const marine = new MarineBackgroundRunner(
      workerLoader,
      controlModuleLoader,
      avmModuleLoader,
    );

    const jsHost = new JsServiceHost();
    super(DEFAULT_CONFIG, keyPair, marine, jsHost, connection);
  }
}

export const mkTestPeer = async () => {
  const kp = await KeyPair.randomEd25519();
  const conn = new NoopConnection();
  return new TestPeer(kp, conn);
};

export const withPeer = async (action: (p: FluencePeer) => Promise<void>) => {
  const p = await mkTestPeer();

  try {
    await p.start();
    await action(p);
  } finally {
    await p.stop();
  }
};

export const withClient = async (
  relay: RelayOptions,
  config: ClientConfig,
  action: (client: ClientPeer) => Promise<void>,
) => {
  const workerLoader = new WorkerLoader();

  const controlModuleLoader = new WasmLoaderFromNpm(
    "@fluencelabs/marine-js",
    "marine-js.wasm",
  );

  const avmModuleLoader = new WasmLoaderFromNpm("@fluencelabs/avm", "avm.wasm");

  const marine = new MarineBackgroundRunner(
    workerLoader,
    controlModuleLoader,
    avmModuleLoader,
  );

  const { keyPair, peerConfig, relayConfig } = await makeClientPeerConfig(
    relay,
    config,
  );

  const client = new ClientPeer(peerConfig, relayConfig, keyPair, marine);

  try {
    await client.connect();
    await action(client);
  } finally {
    await client.disconnect();
  }
};
