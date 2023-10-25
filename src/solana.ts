import {Keypair, PublicKey, TransactionSignature} from "@solana/web3.js";
import idl from "solvoucher.json";
import {notify} from "./utils/notifications";
import {AnchorProvider, BN, Program} from "@coral-xyz/anchor";
import {bs58} from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const textEncoder = new TextEncoder();


export const solVoucherProgram = (connection, anchorWallet) => {
    const provider = new AnchorProvider(connection, anchorWallet, {});
    // @ts-ignore
    return new Program(idl, new PublicKey(idl.metadata.address), provider);
}

export const notifyTxError = (message: string, error: any, tx: TransactionSignature) => {
    notify({type: 'error', message: message, description: error?.message, txid: tx});
    console.log('error', message, error?.message, tx);
}

export const notifyTxSuccess = (message: string, tx: TransactionSignature) => {
    notify({type: 'success', message: message, txid: tx});
}


// Account derivation
export const deriveConfig = (program: Program, collectionName: string) =>
    PublicKey.findProgramAddressSync(
        [textEncoder.encode("config"), textEncoder.encode(collectionName)],
        program.programId
    );

export const deriveVoucher = (program: Program, collectionName: string, offset: number) =>
    PublicKey.findProgramAddressSync(
        [textEncoder.encode("voucher"), textEncoder.encode(collectionName), new BN(offset).toArrayLike(Buffer, "le", 4)],
        program.programId
    );

export const deriveOwnerToVoucher = (program: Program, collectionName: string, payer: PublicKey) =>
    PublicKey.findProgramAddressSync(
        [textEncoder.encode("owner_to_voucher"), textEncoder.encode(collectionName), payer.toBuffer()],
        program.programId
    );

export const getKeyPairForSecretKeyBase58 = (secretKeyBase58) => {
    try {
        return Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
    } catch (e) {
        return undefined;
    }
}