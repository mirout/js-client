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

import { JSONArray, JSONValue } from "@fluencelabs/interfaces";

import { ParticleContext } from "../jsServiceHost/interfaces.js";

export type MaybePromise<T> = T | Promise<T>;

export type ServiceImpl = Record<
  string,
  (args: {
    args: JSONArray;
    context: ParticleContext;
  }) => MaybePromise<JSONValue>
>;

export type UserServiceImpl = Record<
  string,
  (...args: [...JSONArray, ParticleContext]) => MaybePromise<JSONValue>
>;

export type ServiceFnArgs<T> = { args: T; context: ParticleContext };
