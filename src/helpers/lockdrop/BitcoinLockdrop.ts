import { Message } from 'bitcore-lib';
import * as bitcoinjs from 'bitcoinjs-lib';
import bip68 from 'bip68';
import { UnspentTx } from '../../types/LockdropModels';
import { Transaction, Signer, Network } from 'bitcoinjs-lib';
import { BlockCypherApi } from '../../types/BlockCypherTypes';
import BigNumber from 'bignumber.js';

//const BTC_TX_API_TESTNET = 'https://api.blockcypher.com/v1/btc/test3/txs/';
//const BTC_ADDR_API_TESTNET = 'https://api.blockcypher.com/v1/btc/test3/addrs/';

//const BTC_TX_API_MAINNET = 'https://api.blockcypher.com/v1/btc/main/txs/';
//const BTC_ADDR_API_MAINNET = 'https://api.blockcypher.com/v1/btc/main/addrs/';

/**
 * the message that will be hashed and signed by the client
 */
export const MESSAGE = 'plasm network btc lock'; //todo: add nonce for security

/**
 * returns a blob url for the qr encoded bitcoin address
 * @param btcAddress bitcoin address
 */
export async function qrEncodeUri(btcAddress: string, size = 300) {
    const qrCode = URL.createObjectURL(
        await fetch(`https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${btcAddress}`).then(res =>
            res.blob(),
        ),
    );

    return qrCode;
}

/**
 * returns the detailed information of the given address via blockcypher API calls.
 * such information includes transaction references, account balances, and more
 * @param address bitcoin address
 * @param network network type
 * @param limit filters the number of transaction references
 */
export async function getAddressEndpoint(address: string, network: 'main' | 'test3', limit = 20) {
    const api = `https://api.blockcypher.com/v1/btc/${network}/addrs/${address}?limit=${limit}`;

    const res = await (await fetch(api)).text();

    if (res.includes('error')) {
        throw new Error(res);
    }

    const addressEndpoint: BlockCypherApi.BtcAddress = JSON.parse(res);
    return addressEndpoint;
}

/**
 * returns the detailed information of the given transaction hash via blockcypher API calls.
 * such information includes transaction input, output, addresses, and more
 * @param txHash bitcoin transaction hash
 * @param network network type
 * @param limit filters the number of TX inputs and outputs
 */
export async function getTransactionEndpoint(txHash: string, network: 'main' | 'test3', limit = 20) {
    const api = `https://api.blockcypher.com/v1/btc/${network}/txs/${txHash}?limit=${limit}`;

    const res = await (await fetch(api)).text();

    if (res.includes('error')) {
        throw new Error(res);
    }

    const hashEndpoint: BlockCypherApi.BtcTxHash = JSON.parse(res);
    return hashEndpoint;
}

/**
 * Validates the given BTC address by checking if it's in the correct format.
 * The default network is set to mainnet, byt anything else will require you to explicitly
 * pass it as the parameter.
 * @param address Bitcoin public address
 * @param network bitcoin network type (bitcoinjs-lib)
 */
export function validateBtcAddress(address: string, network?: bitcoinjs.networks.Network) {
    // Bitcoin address prefixes
    try {
        bitcoinjs.address.toOutputScript(address, network);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Validates the given public key hex by importing it through bitcoinjs ECPair.
 * @param publicKey Bitcoin public key hex string
 * @param network bitcoin network to check from. Defaults to mainnet
 */
export function validatePublicKey(publicKey: string, network?: bitcoinjs.networks.Network) {
    try {
        bitcoinjs.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'), { network: network });

        const { address } = bitcoinjs.payments.p2pkh({ pubkey: Buffer.from(publicKey, 'hex'), network: network });
        if (typeof address === 'string' && !validateBtcAddress(address, network)) {
            throw new Error('Invalid public key');
        }

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * returns the network type that the given address belongs to.
 * this will also validate the address before returning a value.
 * @param address bitcoin address
 */
export function getNetworkFromAddress(address: string) {
    // sources: https://en.bitcoin.it/wiki/List_of_address_prefixes
    // main net public key hash prefixes
    const mainNetPref = ['1', '3', 'bc1'];
    // test net public key hash prefixes
    const testNetPref = ['m', 'n', 'tb1', '2'];
    let addressNetwork: bitcoinjs.networks.Network;

    if (new RegExp(`^(${mainNetPref.join('|')})`).test(address)) {
        // check for regex match from the given address and array
        addressNetwork = bitcoinjs.networks.bitcoin;
        //return bitcoinjs.networks.bitcoin;
    } else if (new RegExp(`^(${testNetPref.join('|')})`).test(address)) {
        addressNetwork = bitcoinjs.networks.testnet;
        //return bitcoinjs.networks.testnet;
    } else {
        throw new Error('Invalid Bitcoin address');
    }

    if (!validateBtcAddress(address, addressNetwork)) {
        throw new Error('Invalid Bitcoin address');
    }
    return addressNetwork;
}

/**
 * converts satoshi to bitcoin
 * @param satoshi number of satoshi
 */
export function satoshiToBitcoin(satoshi: BigNumber | number | string) {
    // 1 bitcoin = 100,000,000 satoshi

    const denominator = new BigNumber(10).pow(new BigNumber(8));

    // if the parameter is a number, convert it to BN
    if (typeof satoshi === 'number' || typeof satoshi == 'string') {
        return new BigNumber(satoshi).div(denominator);
    }
    return satoshi.div(denominator);
}

/**
 * converts bitcoin into satoshi
 * @param bitcoin number of bitcoin
 */
export function bitcoinToSatoshi(bitcoin: BigNumber | number | string) {
    // 1 bitcoin = 100,000,000 satoshis
    const denominator = new BigNumber('100000000');

    if (typeof bitcoin === 'number' || typeof bitcoin == 'string') {
        return new BigNumber(bitcoin).multipliedBy(denominator);
    }
    return bitcoin.multipliedBy(denominator);
}

/**
 * converts an compressed public key to a uncompressed public key
 * @param publicKey compressed BTC public key
 */
export function decompressPubKey(publicKey: string, network: bitcoinjs.Network) {
    const pubKeyPair = bitcoinjs.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'), {
        compressed: false,
        network: network,
    });
    return pubKeyPair.publicKey.toString('hex');
}

/**
 * compresses the given BTC public key
 * @param publicKey uncompressed BTC public key
 * @param network bitcoin network the public key will encode for
 */
export function compressPubKey(publicKey: string, network: bitcoinjs.Network) {
    const pubKeyPair = bitcoinjs.ECPair.fromPublicKey(Buffer.from(publicKey, 'hex'), {
        compressed: true,
        network: network,
    });
    return pubKeyPair.publicKey.toString('hex');
}

/**
 * returns a public key from the given address and signature
 * by default this will return an uncompressed public key.
 * this function will only work with BIP44 encoded address. BIP49 or BIP84 will return
 * an error.
 * @param address bitcoin address
 * @param signature base 64 signature for signing the plasm network message
 * @param compression should the public key be compressed or not
 */
export function getPublicKey(address: string, signature: string, compression?: 'compressed' | 'uncompressed') {
    const compressedPubKey = new Message(MESSAGE).recoverPublicKey(address, signature.replace(/(\r\n|\n|\r)/gm, ''));
    const addressNetwork = getNetworkFromAddress(address);
    return compression === 'compressed' ? compressedPubKey : decompressPubKey(compressedPubKey, addressNetwork);
}

/**
 * used for CHECKSEQUENCEVERIFY relative time lock.
 * this converts days to bip68 encoded block number.
 * @param days number of days to be converted to sequence number
 */
export function daysToBlockSequence(days: number) {
    // verify lock days value
    if (!Number.isInteger(days) || !Number.isFinite(days)) {
        throw new Error('Lock days must be a valid integer, but received: ' + days);
    }
    const blocksPerDay = 144; //10 min per block. day = 6 * 24
    const blockSequence = bip68.encode({ blocks: days * blocksPerDay });
    if (blockSequence > 65535) {
        // maximum lock time https://en.bitcoin.it/wiki/Timelock
        throw new Error('Block sequence cannot be more than 65535');
    }
    return blockSequence;
}

/**
 * create a bitcoin lock script buffer with the given public key.
 * this will lock the token for the given number of block sequence.
 * if the given public key is not compressed, this function will compress it.
 * @param publicKeyHex compressed BTC public key in hex string
 * @param blockSequence bip68 encoded block sequence
 * @param network bitcoin network the public key belongs to
 */
export function btcLockScript(publicKeyHex: string, blockSequence: number, network: bitcoinjs.Network): Buffer {
    // verify block sequence value
    if (blockSequence < 0) {
        throw new Error('Block sequence cannot be a negative number');
    }
    if (!Number.isInteger(blockSequence) || !Number.isFinite(blockSequence)) {
        throw new Error('Block sequence must be a valid integer, but received: ' + blockSequence);
    }
    if (blockSequence > 65535) {
        // maximum lock time https://en.bitcoin.it/wiki/Timelock
        throw new Error('Block sequence cannot be more than 65535');
    }
    // verify public key by converting to an address
    if (!validatePublicKey(publicKeyHex, network)) {
        throw new Error('Invalid public key');
    }

    const pubKeyBuffer = Buffer.from(compressPubKey(publicKeyHex, network), 'hex');

    return bitcoinjs.script.fromASM(
        `
        ${bitcoinjs.script.number.encode(blockSequence).toString('hex')}
        OP_CHECKSEQUENCEVERIFY
        OP_DROP
        ${pubKeyBuffer.toString('hex')}
        OP_CHECKSIG
        `
            .trim()
            .replace(/\s+/g, ' '),
    );
}

/**
 * creates a P2SH instance that locks the sent token for the given duration.
 * the locked tokens can only be claimed by the provided public key
 * @param lockDays the lock duration in days
 * @param publicKey public key of the locker. This can be both compressed or uncompressed
 * @param network bitcoin network the script will generate for
 */
export function getLockP2SH(lockDays: number, publicKey: string, network: bitcoinjs.Network) {
    if (lockDays > 300 || lockDays < 30) {
        throw new Error('Lock duration must be between 30 days to 300 days');
    }

    return bitcoinjs.payments.p2sh({
        network: network,
        redeem: {
            output: btcLockScript(publicKey, daysToBlockSequence(lockDays), network),
        },
    });
}

/**
 * creates a lock redeem UTXO
 * @param signer the signer for signing the transaction hash
 * @param network network type (bitcoinjs-lib)
 * @param lockTx the transaction that locks the value to P2SH address
 * @param lockScript the lock script (P2SH)
 * @param blockSequence block sequence to lock the funds, should be the same value used in the lock script
 * @param recipient recipient for the transaction output
 * @param fee transaction fee for the lock transaction
 */
export function btcUnlockTx(
    signer: Signer,
    network: Network,
    lockTx: UnspentTx,
    lockScript: Buffer,
    blockSequence: number,
    recipientAddress: string,
    fee: number, // satoshis
): Transaction {
    function idToHash(txid: string): Buffer {
        return Buffer.from(txid, 'hex').reverse();
    }
    function toOutputScript(address: string): Buffer {
        return bitcoinjs.address.toOutputScript(address, network);
    }

    if (blockSequence < 0) {
        throw new Error('Block sequence cannot be less than zeo');
    }
    if (fee < 0) {
        throw new Error('Transaction fee cannot be less than zero');
    }

    if (!Number.isInteger(blockSequence) || !Number.isFinite(blockSequence)) {
        throw new Error('Block sequence must be a valid integer, but received: ' + blockSequence);
    }
    if (!Number.isInteger(fee) || !Number.isFinite(fee)) {
        throw new Error('Fee must be a valid integer, but received: ' + fee);
    }

    //const sequence = bip68.encode({ blocks: lockBlocks });
    const tx = new bitcoinjs.Transaction();
    tx.version = 2;
    tx.addInput(idToHash(lockTx.txId), lockTx.vout, blockSequence);
    tx.addOutput(toOutputScript(recipientAddress), lockTx.value - fee);

    const hashType = bitcoinjs.Transaction.SIGHASH_ALL;
    const signatureHash = tx.hashForSignature(0, lockScript, hashType);
    const signature = bitcoinjs.script.signature.encode(signer.sign(signatureHash), hashType);

    const redeemScriptSig = bitcoinjs.payments.p2sh({
        network,
        redeem: {
            network,
            output: lockScript,
            input: bitcoinjs.script.compile([signature]),
        },
    }).input;
    if (redeemScriptSig instanceof Buffer) {
        tx.setInputScript(0, redeemScriptSig);
    } else {
        throw new Error('Transaction is invalid');
    }

    return tx;
}
