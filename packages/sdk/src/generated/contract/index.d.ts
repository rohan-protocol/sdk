import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  verify_batched_handshakes(context: __compactRuntime.CircuitContext<PS>,
                            previous_root_0: Uint8Array,
                            new_root_0: Uint8Array,
                            batched_proof_data_0: Uint8Array,
                            total_toll_collected_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  initial_setup(context: __compactRuntime.CircuitContext<PS>,
                initial_root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  verify_batched_handshakes(context: __compactRuntime.CircuitContext<PS>,
                            previous_root_0: Uint8Array,
                            new_root_0: Uint8Array,
                            batched_proof_data_0: Uint8Array,
                            total_toll_collected_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  initial_setup(context: __compactRuntime.CircuitContext<PS>,
                initial_root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  verify_batched_handshakes(context: __compactRuntime.CircuitContext<PS>,
                            previous_root_0: Uint8Array,
                            new_root_0: Uint8Array,
                            batched_proof_data_0: Uint8Array,
                            total_toll_collected_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  initial_setup(context: __compactRuntime.CircuitContext<PS>,
                initial_root_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
