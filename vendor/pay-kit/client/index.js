import {
  ADDITIVE_ARRAY_INFO_FIELDS,
  ASSOCIATED_TOKEN_PROGRAM,
  ConfigurationError,
  DEFAULT_RPC_URLS,
  ExactSvmScheme,
  MEMO_PROGRAM,
  SYSTEM_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  UptoSvmScheme,
  buildSubscriptionActivationTransaction,
  charge,
  convertToTokenAmount,
  deepEqual,
  findByNetworkAndScheme,
  findSchemesByNetwork,
  networkMatchesPattern,
  normalizeNetwork,
  parseMoney,
  resolveStablecoinMint,
  serializeSubscriptionAccessCredential,
  session2 as session,
  stablecoinSymbolForCurrency,
  subscription2 as subscription,
  toComparableArray,
  x402HTTPClient,
  x402Version
} from "../chunk-ZY62KQAB.js";

// ../mpp/dist/client/ChallengeSelection.js
import { Challenge } from "mppx";
function selectSolanaChargeChallenge(challenges, options = {}) {
  const candidates = [];
  for (const challenge of challenges) {
    if (challenge.method !== charge.name || challenge.intent !== charge.intent) {
      continue;
    }
    const result = charge.schema.request.safeParse(challenge.request);
    if (!result.success) {
      throw new Error("Invalid Solana charge challenge request");
    }
    const typedChallenge = {
      ...challenge,
      request: result.data
    };
    if (!matchesNetwork(typedChallenge, options.network)) {
      continue;
    }
    candidates.push(typedChallenge);
  }
  if (!options.currency) {
    return candidates[0];
  }
  const acceptedCurrencies = normalizeCurrencyPreference(options.currency);
  for (const acceptedCurrency of acceptedCurrencies) {
    const candidate = candidates.find((challenge) => matchesCurrency(challenge, acceptedCurrency));
    if (candidate) {
      return candidate;
    }
  }
}
function matchesNetwork(challenge, network) {
  if (!network) {
    return true;
  }
  return normalizeNetwork(challenge.request.methodDetails.network ?? "mainnet") === normalizeNetwork(network);
}
function matchesCurrency(challenge, currency) {
  if (!currency) {
    return true;
  }
  const acceptedCurrencies = normalizeCurrencyPreference(currency);
  const challengeNetwork = challenge.request.methodDetails.network;
  return acceptedCurrencies.some((acceptedCurrency) => currenciesMatch(challenge.request.currency, acceptedCurrency, challengeNetwork));
}
function normalizeCurrencyPreference(currency) {
  if (!currency) {
    return [];
  }
  return typeof currency === "string" ? [currency] : currency;
}
function currenciesMatch(challengeCurrency, acceptedCurrency, network) {
  const challengeMint = resolveStablecoinMint(challengeCurrency, network);
  const acceptedMint = resolveStablecoinMint(acceptedCurrency, network);
  return challengeMint === acceptedMint;
}

// ../mpp/dist/client/Charge.js
import { AccountRole, address, appendTransactionMessageInstructions, createSolanaRpc, createTransactionMessage, getBase64EncodedWireTransaction, partiallySignTransactionMessageWithSigners, pipe, prependTransactionMessageInstructions, setTransactionMessageFeePayer, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signature as toSignature, signTransactionMessageWithSigners } from "@solana/kit";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";

// ../../node_modules/.pnpm/@solana-program+system@0.12.0_@solana+kit@6.10.0_bufferutil@4.1.0_fastestsmallesttexten_8f4501ee89e74bb81fcee61fc6b99390/node_modules/@solana-program/system/dist/src/index.mjs
import { getEnumEncoder, getU32Encoder, getEnumDecoder, getU32Decoder, combineCodec, getStructEncoder, getAddressEncoder, getU64Encoder, getStructDecoder, getAddressDecoder, getU64Decoder, decodeAccount, assertAccountExists, fetchEncodedAccount, assertAccountsExist, fetchEncodedAccounts, transformEncoder, SolanaError, SOLANA_ERROR__PROGRAM_CLIENTS__INSUFFICIENT_ACCOUNT_METAS, addEncoderSizePrefix, getUtf8Encoder, addDecoderSizePrefix, getUtf8Decoder, containsBytes, SOLANA_ERROR__PROGRAM_CLIENTS__FAILED_TO_IDENTIFY_INSTRUCTION, SOLANA_ERROR__PROGRAM_CLIENTS__UNRECOGNIZED_INSTRUCTION_TYPE, assertIsInstructionWithAccounts, isProgramError, BASE_ACCOUNT_SIZE } from "@solana/kit";
import { getAccountMetaFactory, addSelfFetchFunctions, addSelfPlanAndSendFunctions } from "@solana/kit/program-client-core";
var TRANSFER_SOL_DISCRIMINATOR = 2;
function getTransferSolInstructionDataEncoder() {
  return transformEncoder(
    getStructEncoder([
      ["discriminator", getU32Encoder()],
      ["amount", getU64Encoder()]
    ]),
    (value) => ({ ...value, discriminator: TRANSFER_SOL_DISCRIMINATOR })
  );
}
function getTransferSolInstruction(input, config) {
  const programAddress = config?.programAddress ?? SYSTEM_PROGRAM_ADDRESS;
  const originalAccounts = {
    source: { value: input.source ?? null, isWritable: true },
    destination: { value: input.destination ?? null, isWritable: true }
  };
  const accounts = originalAccounts;
  const args = { ...input };
  const getAccountMeta = getAccountMetaFactory(programAddress, "omitted");
  return Object.freeze({
    accounts: [getAccountMeta("source", accounts.source), getAccountMeta("destination", accounts.destination)],
    data: getTransferSolInstructionDataEncoder().encode(args),
    programAddress
  });
}
var SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
var SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE = 0;
var SYSTEM_ERROR__RESULT_WITH_NEGATIVE_LAMPORTS = 1;
var SYSTEM_ERROR__INVALID_PROGRAM_ID = 2;
var SYSTEM_ERROR__INVALID_ACCOUNT_DATA_LENGTH = 3;
var SYSTEM_ERROR__MAX_SEED_LENGTH_EXCEEDED = 4;
var SYSTEM_ERROR__ADDRESS_WITH_SEED_MISMATCH = 5;
var SYSTEM_ERROR__NONCE_NO_RECENT_BLOCKHASHES = 6;
var SYSTEM_ERROR__NONCE_BLOCKHASH_NOT_EXPIRED = 7;
var SYSTEM_ERROR__NONCE_UNEXPECTED_BLOCKHASH_VALUE = 8;
var systemErrorMessages;
if (process.env.NODE_ENV !== "production") {
  systemErrorMessages = {
    [SYSTEM_ERROR__ACCOUNT_ALREADY_IN_USE]: `an account with the same address already exists`,
    [SYSTEM_ERROR__ADDRESS_WITH_SEED_MISMATCH]: `provided address does not match addressed derived from seed`,
    [SYSTEM_ERROR__INVALID_ACCOUNT_DATA_LENGTH]: `cannot allocate account data of this length`,
    [SYSTEM_ERROR__INVALID_PROGRAM_ID]: `cannot assign account to this program id`,
    [SYSTEM_ERROR__MAX_SEED_LENGTH_EXCEEDED]: `length of requested seed is too long`,
    [SYSTEM_ERROR__NONCE_BLOCKHASH_NOT_EXPIRED]: `stored nonce is still in recent_blockhashes`,
    [SYSTEM_ERROR__NONCE_NO_RECENT_BLOCKHASHES]: `advancing stored nonce requires a populated RecentBlockhashes sysvar`,
    [SYSTEM_ERROR__NONCE_UNEXPECTED_BLOCKHASH_VALUE]: `specified nonce does not match stored nonce`,
    [SYSTEM_ERROR__RESULT_WITH_NEGATIVE_LAMPORTS]: `account does not have enough SOL to perform the operation`
  };
}

// ../mpp/dist/client/Charge.js
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import { Credential, Method } from "mppx";
function charge2(parameters) {
  const { signer, broadcast = false, onProgress, maxAmount, expectedNetwork, allowUnknownToken2022 } = parameters;
  const method = Method.toClient(charge, {
    async createCredential({ challenge }) {
      const { methodDetails } = challenge.request;
      const { network, feePayer: serverPaysFees } = methodDetails;
      if (serverPaysFees && broadcast) {
        throw new Error("broadcast=true cannot be used with fee sponsorship (feePayer: true)");
      }
      assertChallengeNotExpired(challenge.expires);
      if (maxAmount !== void 0 && BigInt(challenge.request.amount) > maxAmount) {
        throw new Error(`Challenge amount ${challenge.request.amount} exceeds the configured maxAmount ${maxAmount}`);
      }
      if (expectedNetwork !== void 0 && normalizeNetwork(network ?? "mainnet") !== normalizeNetwork(expectedNetwork)) {
        throw new Error(`Challenge network "${network ?? "mainnet"}" does not match the expected network "${expectedNetwork}"`);
      }
      const encodedTx = await buildChargeTransaction({
        allowUnknownToken2022,
        computeUnitLimit: parameters.computeUnitLimit,
        computeUnitPrice: parameters.computeUnitPrice,
        onProgress,
        request: challenge.request,
        rpcUrl: parameters.rpcUrl ?? DEFAULT_RPC_URLS[normalizeNetwork(network || "mainnet")] ?? DEFAULT_RPC_URLS.mainnet,
        signer
      });
      const rpc = createSolanaRpc(parameters.rpcUrl ?? DEFAULT_RPC_URLS[normalizeNetwork(network || "mainnet")] ?? DEFAULT_RPC_URLS.mainnet);
      if (broadcast) {
        onProgress?.({ type: "paying" });
        const signature = await rpc.sendTransaction(encodedTx, {
          encoding: "base64",
          skipPreflight: false
        }).send();
        onProgress?.({ signature, type: "confirming" });
        await confirmTransaction(rpc, signature);
        onProgress?.({ signature, type: "paid" });
        return Credential.serialize({
          challenge,
          payload: { signature, type: "signature" }
        });
      }
      onProgress?.({ transaction: encodedTx, type: "signed" });
      return Credential.serialize({
        challenge,
        payload: { transaction: encodedTx, type: "transaction" }
      });
    }
  });
  return method;
}
async function buildChargeTransaction(parameters) {
  const { signer, request: { amount, currency, externalId, recipient, methodDetails }, onProgress, allowUnknownToken2022 = false } = parameters;
  const { network, decimals, tokenProgram: tokenProgramAddr, feePayer: serverPaysFees, feePayerKey, recentBlockhash: serverBlockhash, splits } = methodDetails;
  const mint = resolveStablecoinMint(currency, network);
  const rpcUrl = parameters.rpcUrl ?? DEFAULT_RPC_URLS[normalizeNetwork(network || "mainnet")] ?? DEFAULT_RPC_URLS.mainnet;
  const rpc = createSolanaRpc(rpcUrl);
  onProgress?.({
    amount,
    currency,
    feePayerKey: feePayerKey || void 0,
    recipient,
    type: "challenge"
  });
  if (serverPaysFees && !feePayerKey) {
    throw new Error("feePayer=true requires feePayerKey in methodDetails");
  }
  const useServerFeePayer = serverPaysFees === true;
  const splitsTotal = (splits ?? []).reduce((sum, s) => sum + BigInt(s.amount), 0n);
  const primaryAmount = BigInt(amount) - splitsTotal;
  if (primaryAmount <= 0n) {
    throw new Error("Splits consume the entire amount; primary recipient must receive a positive amount");
  }
  const hasAtaCreationSplits = splits?.some((split) => split.ataCreationRequired === true) === true;
  if (!mint && hasAtaCreationSplits) {
    throw new Error("ataCreationRequired requires an SPL token charge");
  }
  if (hasAtaCreationSplits && currency !== mint) {
    throw new Error("ataCreationRequired requires currency to be an SPL token mint address");
  }
  const instructions = [];
  const addMemoInstruction = (memo) => {
    if (!memo)
      return;
    const data = new TextEncoder().encode(memo);
    if (data.byteLength > 566) {
      throw new Error("memo cannot exceed 566 bytes");
    }
    instructions.push({
      accounts: [],
      data,
      programAddress: address(MEMO_PROGRAM)
    });
  };
  if (mint) {
    const mintAddress = address(mint);
    const tokenProg = tokenProgramAddr ? address(tokenProgramAddr) : await resolveTokenProgram(rpc, mintAddress);
    if (String(tokenProg) === TOKEN_2022_PROGRAM && stablecoinSymbolForCurrency(mint) === void 0 && !allowUnknownToken2022) {
      throw new Error("Refusing to sign an unknown Token-2022 mint (transfer-hook risk). Set allowUnknownToken2022: true to override.");
    }
    if (decimals === void 0) {
      throw new Error("methodDetails.decimals is required for SPL charges (spec \xA77.2)");
    }
    const tokenDecimals = decimals;
    const [sourceAta] = await findAssociatedTokenPda({
      mint: mintAddress,
      owner: signer.address,
      tokenProgram: tokenProg
    });
    const findDestinationAta = async (owner) => {
      const [ata] = await findAssociatedTokenPda({
        mint: mintAddress,
        owner,
        tokenProgram: tokenProg
      });
      return ata;
    };
    const addAtaCreation = async (owner) => {
      const ata = await findDestinationAta(owner);
      if (useServerFeePayer) {
        instructions.push(createAssociatedTokenAccountIdempotent(address(feePayerKey), owner, mintAddress, ata, tokenProg));
      } else {
        instructions.push(getCreateAssociatedTokenIdempotentInstruction({
          ata,
          mint: mintAddress,
          owner,
          payer: signer,
          tokenProgram: tokenProg
        }));
      }
      return ata;
    };
    const addSplTransfer = async (dest, transferAmount, createAta) => {
      const destOwner = address(dest);
      const destAta = createAta ? await addAtaCreation(destOwner) : await findDestinationAta(destOwner);
      instructions.push(getTransferCheckedInstruction({
        amount: transferAmount,
        authority: signer,
        decimals: tokenDecimals,
        destination: destAta,
        mint: mintAddress,
        source: sourceAta
      }, { programAddress: tokenProg }));
    };
    await addSplTransfer(recipient, primaryAmount, false);
    addMemoInstruction(externalId);
    for (const split of splits ?? []) {
      await addSplTransfer(split.recipient, BigInt(split.amount), split.ataCreationRequired === true);
      addMemoInstruction(split.memo);
    }
  } else {
    instructions.push(getTransferSolInstruction({
      amount: primaryAmount,
      destination: address(recipient),
      source: signer
    }));
    addMemoInstruction(externalId);
    for (const split of splits ?? []) {
      instructions.push(getTransferSolInstruction({
        amount: BigInt(split.amount),
        destination: address(split.recipient),
        source: signer
      }));
      addMemoInstruction(split.memo);
    }
  }
  onProgress?.({ type: "signing" });
  const latestBlockhash = serverBlockhash ? {
    blockhash: serverBlockhash,
    lastValidBlockHeight: BigInt(0)
    // Server doesn't provide this; tx lifetime is managed by the blockhash itself.
  } : (await rpc.getLatestBlockhash().send()).value;
  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => useServerFeePayer ? setTransactionMessageFeePayer(address(feePayerKey), msg) : setTransactionMessageFeePayerSigner(signer, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
    (msg) => appendTransactionMessageInstructions(instructions, msg),
    // Prepend compute budget instructions per best practice.
    (msg) => prependTransactionMessageInstructions([
      getSetComputeUnitPriceInstruction({ microLamports: parameters.computeUnitPrice ?? 1n }),
      getSetComputeUnitLimitInstruction({ units: parameters.computeUnitLimit ?? 2e5 })
    ], msg)
  );
  const signedTx = useServerFeePayer ? await partiallySignTransactionMessageWithSigners(txMessage) : await signTransactionMessageWithSigners(txMessage);
  return getBase64EncodedWireTransaction(signedTx);
}
function assertChallengeNotExpired(expires) {
  if (expires === void 0)
    return;
  const expiresAt = new Date(expires).getTime();
  if (Number.isNaN(expiresAt)) {
    throw new Error(`Refusing to sign: malformed challenge expires timestamp "${expires}"`);
  }
  if (expiresAt < Date.now()) {
    throw new Error("Refusing to sign an expired challenge");
  }
}
function createAssociatedTokenAccountIdempotent(payer, owner, mint, ata, tokenProgram) {
  return {
    accounts: [
      { address: payer, role: AccountRole.WRITABLE_SIGNER },
      { address: ata, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: address(SYSTEM_PROGRAM), role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY }
    ],
    data: new Uint8Array([1]),
    programAddress: address(ASSOCIATED_TOKEN_PROGRAM)
    // CreateIdempotent discriminator
  };
}
async function resolveTokenProgram(rpc, mint) {
  const account = await rpc.getAccountInfo(mint, { encoding: "base64" }).send();
  const owner = account.value?.owner;
  if (!owner) {
    throw new Error("Failed to determine token program for mint: mint account not found");
  }
  if (owner === TOKEN_PROGRAM || owner === TOKEN_2022_PROGRAM) {
    return address(owner);
  }
  throw new Error(`Failed to determine token program for mint: unexpected owner ${owner}`);
}
async function confirmTransaction(rpc, signature, timeoutMs = 3e4) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await rpc.getSignatureStatuses([toSignature(signature)]).send();
    const status = value[0];
    if (status) {
      if (status.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 2e3));
  }
  throw new Error("Transaction confirmation timeout");
}

// ../mpp/dist/client/PaymentChannels.js
import { address as address2, appendTransactionMessageInstructions as appendTransactionMessageInstructions2, createNoopSigner, createTransactionMessage as createTransactionMessage2, generateKeyPairSigner, getAddressEncoder as getAddressEncoder2, getBase64EncodedWireTransaction as getBase64EncodedWireTransaction2, getProgramDerivedAddress, getU64Encoder as getU64Encoder2, getUtf8Encoder as getUtf8Encoder2, partiallySignTransactionMessageWithSigners as partiallySignTransactionMessageWithSigners2, pipe as pipe2, setTransactionMessageFeePayer as setTransactionMessageFeePayer2, setTransactionMessageLifetimeUsingBlockhash as setTransactionMessageLifetimeUsingBlockhash2 } from "@solana/kit";
import { findAssociatedTokenPda as findAssociatedTokenPda2 } from "@solana-program/token";

// ../mpp/dist/generated/payment-channels/errors/paymentChannels.js
import { isProgramError as isProgramError2 } from "@solana/kit";
var PAYMENT_CHANNELS_ERROR__NOT_IMPLEMENTED = 0;
var PAYMENT_CHANNELS_ERROR__MISSING_REQUIRED_SIGNATURE = 1;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_STATUS = 2;
var PAYMENT_CHANNELS_ERROR__INVALID_ACCOUNT_DISCRIMINATOR = 3;
var PAYMENT_CHANNELS_ERROR__UNSUPPORTED_CHANNEL_VERSION = 4;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_PAYER = 5;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_PAYEE = 6;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_MINT = 7;
var PAYMENT_CHANNELS_ERROR__INVALID_EVENT_AUTHORITY = 8;
var PAYMENT_CHANNELS_ERROR__NOT_ENOUGH_ACCOUNT_KEYS = 9;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_RENT_PAYER = 10;
var PAYMENT_CHANNELS_ERROR__CHANNEL_ACCOUNT_MISMATCH = 50;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_TOKEN_ACCOUNT = 51;
var PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_TOKEN_EXTENSIONS = 52;
var PAYMENT_CHANNELS_ERROR__MINT_ACCOUNT_MISMATCH = 53;
var PAYMENT_CHANNELS_ERROR__INVALID_MINT_TOKEN_PROGRAM = 54;
var PAYMENT_CHANNELS_ERROR__MALFORMED_MINT_TOKEN_ACCOUNT_DATA = 55;
var PAYMENT_CHANNELS_ERROR__MALFORMED_MINT_TOKEN_EXTENSIONS = 56;
var PAYMENT_CHANNELS_ERROR__PAYER_ACCOUNT_MISMATCH = 57;
var PAYMENT_CHANNELS_ERROR__INVALID_PAYER_TOKEN_ACCOUNT = 58;
var PAYMENT_CHANNELS_ERROR__INVALID_PAYER_TOKEN_EXTENSIONS = 59;
var PAYMENT_CHANNELS_ERROR__PAYEE_ACCOUNT_MISMATCH = 60;
var PAYMENT_CHANNELS_ERROR__INVALID_PAYEE_TOKEN_ACCOUNT = 61;
var PAYMENT_CHANNELS_ERROR__INVALID_PAYEE_TOKEN_EXTENSIONS = 62;
var PAYMENT_CHANNELS_ERROR__DEPOSIT_MUST_BE_NON_ZERO = 200;
var PAYMENT_CHANNELS_ERROR__GRACE_PERIOD_MUST_BE_NON_ZERO = 201;
var PAYMENT_CHANNELS_ERROR__MISSING_ED25519_VERIFICATION = 230;
var PAYMENT_CHANNELS_ERROR__MALFORMED_ED25519_INSTRUCTION = 231;
var PAYMENT_CHANNELS_ERROR__VOUCHER_CHANNEL_MISMATCH = 232;
var PAYMENT_CHANNELS_ERROR__VOUCHER_EXPIRED = 233;
var PAYMENT_CHANNELS_ERROR__VOUCHER_WATERMARK_NOT_MONOTONIC = 234;
var PAYMENT_CHANNELS_ERROR__VOUCHER_OVER_DEPOSIT = 235;
var PAYMENT_CHANNELS_ERROR__VOUCHER_MESSAGE_MISMATCH = 236;
var PAYMENT_CHANNELS_ERROR__VOUCHER_SIGNER_MISMATCH = 237;
var PAYMENT_CHANNELS_ERROR__VOUCHER_BAD_MAGIC = 238;
var PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_COUNT = 260;
var PAYMENT_CHANNELS_ERROR__INVALID_SPLIT_CONFIG = 261;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTION_PARTS_OVERFLOW = 262;
var PAYMENT_CHANNELS_ERROR__DUPLICATE_RECIPIENT = 263;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTION_AMOUNT_OVERFLOW = 264;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTION_PREIMAGE_LENGTH_OVERFLOW = 265;
var PAYMENT_CHANNELS_ERROR__CHANNEL_ADDRESS_MISMATCH = 2e3;
var PAYMENT_CHANNELS_ERROR__PAYER_PAYEE_MUST_DIFFER = 2001;
var PAYMENT_CHANNELS_ERROR__INVALID_AUTHORIZED_SIGNER = 2002;
var PAYMENT_CHANNELS_ERROR__OPEN_SLOT_OUT_OF_WINDOW = 2003;
var PAYMENT_CHANNELS_ERROR__TOP_UP_DEPOSIT_OVERFLOW = 2100;
var PAYMENT_CHANNELS_ERROR__SEAL_DEADLINE_OVERFLOW = 2200;
var PAYMENT_CHANNELS_ERROR__SEAL_GRACE_PERIOD_NOT_ELAPSED = 2201;
var PAYMENT_CHANNELS_ERROR__PAYER_ALREADY_WITHDRAWN = 2300;
var PAYMENT_CHANNELS_ERROR__REFUND_CALCULATION_OVERFLOW = 2301;
var PAYMENT_CHANNELS_ERROR__CHANNEL_NOT_DISTRIBUTABLE = 2400;
var PAYMENT_CHANNELS_ERROR__TREASURY_ACCOUNT_MISMATCH = 2401;
var PAYMENT_CHANNELS_ERROR__INVALID_TREASURY_TOKEN_ACCOUNT = 2402;
var PAYMENT_CHANNELS_ERROR__INVALID_TREASURY_TOKEN_EXTENSIONS = 2403;
var PAYMENT_CHANNELS_ERROR__RECIPIENT_ACCOUNT_MISMATCH = 2404;
var PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_TOKEN_ACCOUNT = 2405;
var PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_TOKEN_EXTENSIONS = 2406;
var PAYMENT_CHANNELS_ERROR__INVALID_DISTRIBUTION_HASH = 2407;
var PAYMENT_CHANNELS_ERROR__NOTHING_TO_DISTRIBUTE = 2408;
var PAYMENT_CHANNELS_ERROR__RECIPIENT_ACCOUNT_COUNT_MISMATCH = 2409;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTE_POOL_OVERFLOW = 2410;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTE_BALANCE_CALCULATION_OVERFLOW = 2411;
var PAYMENT_CHANNELS_ERROR__RENT_PAYER_BALANCE_OVERFLOW = 2412;
var PAYMENT_CHANNELS_ERROR__DISTRIBUTE_TRANSFER_QUEUE_OVERFLOW = 2413;
var PAYMENT_CHANNELS_ERROR__CHANNEL_CLOSE_TOO_EARLY = 2414;
var paymentChannelsErrorMessages;
if (process.env["NODE_ENV"] !== "production") {
  paymentChannelsErrorMessages = {
    [PAYMENT_CHANNELS_ERROR__CHANNEL_ACCOUNT_MISMATCH]: `Channel account does not match derived PDA`,
    [PAYMENT_CHANNELS_ERROR__CHANNEL_ADDRESS_MISMATCH]: `Derived channel account address does not match the user provided address`,
    [PAYMENT_CHANNELS_ERROR__CHANNEL_CLOSE_TOO_EARLY]: `Channel cannot be fully closed until clock.slot > open_slot + OPEN_SLOT_WINDOW`,
    [PAYMENT_CHANNELS_ERROR__CHANNEL_NOT_DISTRIBUTABLE]: `Channel is not in OPEN or SEALED`,
    [PAYMENT_CHANNELS_ERROR__DEPOSIT_MUST_BE_NON_ZERO]: `Deposit must be non-zero`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTE_BALANCE_CALCULATION_OVERFLOW]: `Channel rent rebalance calculation underflow`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTE_POOL_OVERFLOW]: `Distribution pool calculation underflow`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTE_TRANSFER_QUEUE_OVERFLOW]: `Transfer queue capacity exceeded`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTION_AMOUNT_OVERFLOW]: `num_recipients outside [0, 32]`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTION_PARTS_OVERFLOW]: `num_recipients outside [0, 32]`,
    [PAYMENT_CHANNELS_ERROR__DISTRIBUTION_PREIMAGE_LENGTH_OVERFLOW]: `Distribution preimage length calculation overflow`,
    [PAYMENT_CHANNELS_ERROR__DUPLICATE_RECIPIENT]: `Distribution plan contains a duplicate recipient address`,
    [PAYMENT_CHANNELS_ERROR__GRACE_PERIOD_MUST_BE_NON_ZERO]: `Grace period must be non-zero`,
    [PAYMENT_CHANNELS_ERROR__INVALID_ACCOUNT_DISCRIMINATOR]: `Invalid account discriminator`,
    [PAYMENT_CHANNELS_ERROR__INVALID_AUTHORIZED_SIGNER]: `authorized_signer must be a valid Ed25519 public key`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_MINT]: `Account does not match channel mint`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_PAYEE]: `Account does not match channel payee`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_PAYER]: `Account does not match channel payer`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_RENT_PAYER]: `Account does not match channel rent_payer`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_STATUS]: `Invalid channel status`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_TOKEN_ACCOUNT]: `Channel token account is not ATA(channel, mint, token_program)`,
    [PAYMENT_CHANNELS_ERROR__INVALID_CHANNEL_TOKEN_EXTENSIONS]: `Channel token account has invalid extensions`,
    [PAYMENT_CHANNELS_ERROR__INVALID_DISTRIBUTION_HASH]: `Distribution hash mismatch`,
    [PAYMENT_CHANNELS_ERROR__INVALID_EVENT_AUTHORITY]: `Invalid event authority`,
    [PAYMENT_CHANNELS_ERROR__INVALID_MINT_TOKEN_PROGRAM]: `Token program must be SPL Token or Token-2022`,
    [PAYMENT_CHANNELS_ERROR__INVALID_PAYEE_TOKEN_ACCOUNT]: `Payee token account is invalid`,
    [PAYMENT_CHANNELS_ERROR__INVALID_PAYEE_TOKEN_EXTENSIONS]: `Payee token account has invalid extensions`,
    [PAYMENT_CHANNELS_ERROR__INVALID_PAYER_TOKEN_ACCOUNT]: `Payer token account is invalid`,
    [PAYMENT_CHANNELS_ERROR__INVALID_PAYER_TOKEN_EXTENSIONS]: `Payer token account has invalid extensions`,
    [PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_COUNT]: `num_recipients outside [0, 32]`,
    [PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_TOKEN_ACCOUNT]: `Recipient token account is invalid`,
    [PAYMENT_CHANNELS_ERROR__INVALID_RECIPIENT_TOKEN_EXTENSIONS]: `Recipient token account has invalid extensions`,
    [PAYMENT_CHANNELS_ERROR__INVALID_SPLIT_CONFIG]: `Each shareBps must be non-zero and \u03A3bps must be at most 10_000`,
    [PAYMENT_CHANNELS_ERROR__INVALID_TREASURY_TOKEN_ACCOUNT]: `Treasury token account is invalid`,
    [PAYMENT_CHANNELS_ERROR__INVALID_TREASURY_TOKEN_EXTENSIONS]: `Treasury token account has invalid extensions`,
    [PAYMENT_CHANNELS_ERROR__MALFORMED_ED25519_INSTRUCTION]: `Malformed Ed25519 precompile instruction`,
    [PAYMENT_CHANNELS_ERROR__MALFORMED_MINT_TOKEN_ACCOUNT_DATA]: `Token account or mint TLV trailer is malformed`,
    [PAYMENT_CHANNELS_ERROR__MALFORMED_MINT_TOKEN_EXTENSIONS]: `Token account or mint TLV trailer is malformed`,
    [PAYMENT_CHANNELS_ERROR__MINT_ACCOUNT_MISMATCH]: `Mint account does not match channel.mint`,
    [PAYMENT_CHANNELS_ERROR__MISSING_ED25519_VERIFICATION]: `Missing Ed25519 precompile ix at current-1`,
    [PAYMENT_CHANNELS_ERROR__MISSING_REQUIRED_SIGNATURE]: `A signature was required but not found`,
    [PAYMENT_CHANNELS_ERROR__NOT_ENOUGH_ACCOUNT_KEYS]: `Not enough accounts were provided`,
    [PAYMENT_CHANNELS_ERROR__NOTHING_TO_DISTRIBUTE]: `No newly settled funds to distribute`,
    [PAYMENT_CHANNELS_ERROR__NOT_IMPLEMENTED]: `Not implemented`,
    [PAYMENT_CHANNELS_ERROR__OPEN_SLOT_OUT_OF_WINDOW]: `open_slot is in the future or older than the allowed slot window`,
    [PAYMENT_CHANNELS_ERROR__PAYEE_ACCOUNT_MISMATCH]: `Payee token account is not ATA(payee, token_program, mint)`,
    [PAYMENT_CHANNELS_ERROR__PAYER_ACCOUNT_MISMATCH]: `Payer token account is not ATA(payer, token_program, mint)`,
    [PAYMENT_CHANNELS_ERROR__PAYER_ALREADY_WITHDRAWN]: `Payer refund has already been claimed`,
    [PAYMENT_CHANNELS_ERROR__PAYER_PAYEE_MUST_DIFFER]: `Payer and payee must be different accounts`,
    [PAYMENT_CHANNELS_ERROR__RECIPIENT_ACCOUNT_COUNT_MISMATCH]: `Recipient ATA tail length does not match the committed plan's entry count`,
    [PAYMENT_CHANNELS_ERROR__RECIPIENT_ACCOUNT_MISMATCH]: `Recipient token account is not ATA(recipient, token_program, mint)`,
    [PAYMENT_CHANNELS_ERROR__REFUND_CALCULATION_OVERFLOW]: `Payer refund amount calculation underflow`,
    [PAYMENT_CHANNELS_ERROR__RENT_PAYER_BALANCE_OVERFLOW]: `Rent payer lamports overflow on channel deallocation`,
    [PAYMENT_CHANNELS_ERROR__SEAL_DEADLINE_OVERFLOW]: `Deadline overflow on grace period`,
    [PAYMENT_CHANNELS_ERROR__SEAL_GRACE_PERIOD_NOT_ELAPSED]: `Grace period has not elapsed yet`,
    [PAYMENT_CHANNELS_ERROR__TOP_UP_DEPOSIT_OVERFLOW]: `Deposit must be non-zero`,
    [PAYMENT_CHANNELS_ERROR__TREASURY_ACCOUNT_MISMATCH]: `Treasury token account is not ATA(TREASURY_OWNER, mint, token_program)`,
    [PAYMENT_CHANNELS_ERROR__UNSUPPORTED_CHANNEL_VERSION]: `Unsupported channel version`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_BAD_MAGIC]: `Voucher payload magic prefix is invalid`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_CHANNEL_MISMATCH]: `Voucher channel_id does not match channel PDA`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_EXPIRED]: `Voucher expired`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_MESSAGE_MISMATCH]: `Reserved (formerly: Ed25519 message does not match Borsh voucher payload)`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_OVER_DEPOSIT]: `Voucher cumulative_amount exceeds channel deposit`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_SIGNER_MISMATCH]: `Voucher signer does not match channel authorized_signer`,
    [PAYMENT_CHANNELS_ERROR__VOUCHER_WATERMARK_NOT_MONOTONIC]: `Voucher watermark not strictly monotonic`
  };
}

// ../mpp/dist/client/PaymentChannels.js
var U64_MAX = (1n << 64n) - 1n;

// ../mpp/dist/client/Methods.js
var solana = Object.assign((parameters) => charge2(parameters), {
  buildChargeTransaction,
  buildSubscriptionActivationTransaction,
  charge: charge2,
  selectChargeChallenge: selectSolanaChargeChallenge,
  session,
  subscription
});

// ../mpp/dist/client/SessionFetch.js
import { getBase58Decoder } from "@solana/kit";
var U64_MAX2 = (1n << 64n) - 1n;
var globalFetchPatchLock = Promise.resolve();

// ../mpp/dist/client/SessionUsageMeter.js
var U64_MAX3 = (1n << 64n) - 1n;

// ../mpp/dist/client/index.js
import { Mppx } from "mppx/client";

// ../mpp/dist/shared/challenge-guard.js
import { Challenge as MppxChallenge } from "mppx";
function assertNonEmptyId(challenge) {
  if (typeof challenge.id !== "string" || challenge.id.length === 0) {
    throw new Error("challenge id must be a non-empty value");
  }
}
var MAX_CHALLENGE_HEADER_LEN = 16 * 1024;
function assertWithinSizeCap(value) {
  if (value.length > MAX_CHALLENGE_HEADER_LEN) {
    throw new Error(`challenge header exceeds maximum size of ${MAX_CHALLENGE_HEADER_LEN} bytes`);
  }
}
var deserialize = ((value, options) => {
  if (typeof value === "string")
    assertWithinSizeCap(value);
  const challenge = MppxChallenge.deserialize(value, options);
  assertNonEmptyId(challenge);
  return challenge;
});
var deserializeList = ((value, options) => {
  if (typeof value === "string")
    assertWithinSizeCap(value);
  const challenges = MppxChallenge.deserializeList(value, options);
  for (const challenge of challenges)
    assertNonEmptyId(challenge);
  return challenges;
});
var Challenge2 = {
  ...MppxChallenge,
  deserialize,
  deserializeList
};

// ../../node_modules/.pnpm/@x402+core@file+.x402-vendor+x402-core-2.23.0.tgz/node_modules/@x402/core/dist/esm/client/index.mjs
var DEFAULT_MAX_AMOUNT_PER_PAYMENT = "$1";
var x402Client = class _x402Client {
  /**
   * Creates a new x402Client instance.
   *
   * @param paymentRequirementsSelector - Function to select payment requirements from available options
   */
  constructor(paymentRequirementsSelector) {
    this.registeredClientSchemes = /* @__PURE__ */ new Map();
    this.schemeClientHookAdapters = /* @__PURE__ */ new Map();
    this.policies = [];
    this.registeredExtensions = /* @__PURE__ */ new Map();
    this.spendControls = {};
    this.beforePaymentCreationHooks = [];
    this.afterPaymentCreationHooks = [];
    this.onPaymentCreationFailureHooks = [];
    this.paymentResponseHooks = [];
    this.paymentRequirementsSelector = paymentRequirementsSelector || ((x402Version2, accepts) => accepts[0]);
  }
  /**
   * Creates a new x402Client instance from a configuration object.
   *
   * @param config - The client configuration including schemes, policies, and payment requirements selector
   * @returns A configured x402Client instance
   */
  static fromConfig(config) {
    const client = new _x402Client(config.paymentRequirementsSelector);
    config.schemes.forEach((scheme) => {
      if (scheme.x402Version === 1) {
        client.registerV1(scheme.network, scheme.client);
      } else {
        client.register(scheme.network, scheme.client);
      }
    });
    config.policies?.forEach((policy) => {
      client.registerPolicy(policy);
    });
    if (config.spendControls !== void 0) {
      client.setSpendControls(config.spendControls);
    }
    return client;
  }
  /**
   * Registers a scheme client for the current x402 version.
   *
   * @param network - The network to register the client for
   * @param client - The scheme network client to register
   * @returns The x402Client instance for chaining
   */
  register(network, client) {
    return this._registerScheme(x402Version, network, client);
  }
  /**
   * Registers a scheme client for x402 version 1.
   *
   * @param network - The v1 network identifier (e.g., 'base-sepolia', 'solana-devnet')
   * @param client - The scheme network client to register
   * @returns The x402Client instance for chaining
   */
  registerV1(network, client) {
    return this._registerScheme(1, network, client);
  }
  /**
   * Registers a policy to filter or transform payment requirements.
   *
   * Policies are applied in order after filtering by registered schemes
   * and before the selector chooses the final payment requirement.
   *
   * @param policy - Function to filter/transform payment requirements
   * @returns The x402Client instance for chaining
   *
   * @example
   * ```typescript
   * // Prefer cheaper options
   * client.registerPolicy((version, reqs) =>
   *   reqs.filter(r => BigInt(r.value) < BigInt('1000000'))
   * );
   *
   * // Prefer specific networks
   * client.registerPolicy((version, reqs) =>
   *   reqs.filter(r => r.network.startsWith('eip155:'))
   * );
   * ```
   */
  registerPolicy(policy) {
    this.policies.push(policy);
    return this;
  }
  /**
   * Replace spend controls. Pass `false` to disable all spend controls.
   * When an object is passed, omitted `maxAmountPerPayment` still defaults to
   * {@link DEFAULT_MAX_AMOUNT_PER_PAYMENT}.
   *
   * @param controls - Spend control configuration, or `false` to disable
   * @returns This client for chaining
   */
  setSpendControls(controls) {
    this.spendControls = controls;
    return this;
  }
  /**
   * Registers a client extension that can enrich payment payloads.
   *
   * Extensions are invoked after the scheme creates the base payload and the
   * payload is wrapped with extensions/resource/accepted data. Every registered
   * extension's `enrichPaymentPayload` hook is called to modify the payload.
   * Server-declared fields are preserved via merge after enrichment.
   *
   * @param extension - The client extension to register
   * @returns The x402Client instance for chaining
   */
  registerExtension(extension) {
    this.registeredExtensions.set(extension.key, extension);
    return this;
  }
  /**
   * Get all registered client extensions.
   *
   * @returns Array of registered extensions
   */
  getExtensions() {
    return Array.from(this.registeredExtensions.values());
  }
  /**
   * Register a hook to execute before payment payload creation.
   * Can abort creation by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The x402Client instance for chaining
   */
  onBeforePaymentCreation(hook) {
    this.beforePaymentCreationHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after successful payment payload creation.
   *
   * @param hook - The hook function to register
   * @returns The x402Client instance for chaining
   */
  onAfterPaymentCreation(hook) {
    this.afterPaymentCreationHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute when payment payload creation fails.
   * Can recover from failure by returning { recovered: true, payload: PaymentPayload }
   *
   * @param hook - The hook function to register
   * @returns The x402Client instance for chaining
   */
  onPaymentCreationFailure(hook) {
    this.onPaymentCreationFailureHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after a paid request completes.
   * Can signal recovery by returning { recovered: true }, causing the transport to retry.
   *
   * @param hook - The hook function to register
   * @returns The x402Client instance for chaining
   */
  onPaymentResponse(hook) {
    this.paymentResponseHooks.push(hook);
    return this;
  }
  /**
   * Fires all registered payment response hooks in order.
   * Returns `{ recovered: true }` if any hook signals recovery (first wins).
   *
   * @param ctx - The payment response context
   * @returns Recovery signal or undefined
   */
  async handlePaymentResponse(ctx) {
    for (const hook of this.getLabeledHooks(
      "onPaymentResponse",
      ctx.paymentPayload.x402Version,
      ctx.requirements,
      ctx.paymentRequired?.extensions ?? ctx.paymentPayload.extensions
    )) {
      const result = await hook(ctx);
      if (result && "recovered" in result && result.recovered) {
        return { recovered: true };
      }
    }
    return void 0;
  }
  /**
   * Creates a payment payload based on a PaymentRequired response.
   *
   * Automatically extracts x402Version, resource, and extensions from the PaymentRequired
   * response and constructs a complete PaymentPayload with the accepted requirements.
   *
   * @param paymentRequired - The PaymentRequired response from the server
   * @returns Promise resolving to the complete payment payload
   */
  async createPaymentPayload(paymentRequired) {
    const clientSchemesByNetwork = this.registeredClientSchemes.get(paymentRequired.x402Version);
    if (!clientSchemesByNetwork) {
      throw new Error(`No client registered for x402 version: ${paymentRequired.x402Version}`);
    }
    const requirements = this.selectPaymentRequirements(paymentRequired.x402Version, paymentRequired.accepts);
    const context = {
      paymentRequired,
      selectedRequirements: requirements
    };
    for (const hook of this.getLabeledHooks(
      "beforePaymentCreation",
      paymentRequired.x402Version,
      requirements,
      paymentRequired.extensions
    )) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        throw new Error(`Payment creation aborted: ${result.reason}`);
      }
    }
    try {
      const schemeNetworkClient = findByNetworkAndScheme(clientSchemesByNetwork, requirements.scheme, requirements.network);
      if (!schemeNetworkClient) {
        throw new Error(`No client registered for scheme: ${requirements.scheme} and network: ${requirements.network}`);
      }
      const partialPayload = await schemeNetworkClient.createPaymentPayload(
        paymentRequired.x402Version,
        requirements,
        { extensions: paymentRequired.extensions }
      );
      let paymentPayload;
      if (partialPayload.x402Version == 1) {
        paymentPayload = partialPayload;
      } else {
        const mergedExtensions = this.mergeExtensions(
          paymentRequired.extensions,
          partialPayload.extensions
        );
        paymentPayload = {
          x402Version: partialPayload.x402Version,
          payload: partialPayload.payload,
          extensions: mergedExtensions,
          resource: paymentRequired.resource,
          accepted: requirements
        };
      }
      paymentPayload = await this.enrichPaymentPayloadWithExtensions(paymentPayload, paymentRequired);
      const createdContext = {
        ...context,
        paymentPayload
      };
      for (const hook of this.getLabeledHooks(
        "afterPaymentCreation",
        paymentRequired.x402Version,
        requirements,
        paymentRequired.extensions
      )) {
        await hook(createdContext);
      }
      return paymentPayload;
    } catch (error) {
      const failureContext = {
        ...context,
        error
      };
      for (const hook of this.getLabeledHooks(
        "onPaymentCreationFailure",
        paymentRequired.x402Version,
        requirements,
        paymentRequired.extensions
      )) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.payload;
        }
      }
      throw error;
    }
  }
  /**
   * Merges server-declared extensions with client extension echoes.
   * Client extension data may add fields, but server-declared fields remain intact.
   * For fields listed in `ADDITIVE_ARRAY_INFO_FIELDS` (e.g. builder-code `s`), a
   * conflicting array is concatenated with client entries first (so a downstream
   * length cap trims server entries rather than the client's) and duplicates
   * removed; a scalar on either side is treated as a single-element array. Every
   * other conflicting array keeps the server's value, same as any other scalar.
   *
   * @param serverExtensions - Extensions declared by the server in the 402 response
   * @param clientExtensions - Extensions provided by the client or scheme
   * @returns The merged extensions object, or undefined if both inputs are undefined
   */
  mergeExtensions(serverExtensions, clientExtensions) {
    if (!clientExtensions) return serverExtensions;
    if (!serverExtensions) return clientExtensions;
    const merged = { ...serverExtensions };
    for (const [key, clientValue] of Object.entries(clientExtensions)) {
      const serverValue = merged[key];
      if (serverValue === null || typeof serverValue !== "object" || Array.isArray(serverValue) || clientValue === null || typeof clientValue !== "object" || Array.isArray(clientValue)) {
        merged[key] = clientValue;
        continue;
      }
      const serverRecord = serverValue;
      const clientRecord = clientValue;
      const additiveFields = ADDITIVE_ARRAY_INFO_FIELDS[key];
      const extensionValue = { ...serverRecord };
      const pending = [{ target: extensionValue, source: clientRecord }];
      for (const item of pending) {
        for (const [fieldKey, clientFieldValue] of Object.entries(item.source)) {
          const serverFieldValue = item.target[fieldKey];
          if (serverFieldValue !== null && typeof serverFieldValue === "object" && !Array.isArray(serverFieldValue) && clientFieldValue !== null && typeof clientFieldValue === "object" && !Array.isArray(clientFieldValue)) {
            const nestedValue = { ...serverFieldValue };
            item.target[fieldKey] = nestedValue;
            pending.push({
              target: nestedValue,
              source: clientFieldValue
            });
            continue;
          }
          if (additiveFields?.has(fieldKey) && (Array.isArray(serverFieldValue) || Array.isArray(clientFieldValue))) {
            const serverArray = toComparableArray(serverFieldValue);
            const clientArray = toComparableArray(clientFieldValue);
            if (serverArray && clientArray) {
              item.target[fieldKey] = mergeArraysUnique(clientArray, serverArray);
              continue;
            }
          }
          if (!Object.prototype.hasOwnProperty.call(item.target, fieldKey)) {
            item.target[fieldKey] = clientFieldValue;
          }
        }
      }
      merged[key] = extensionValue;
    }
    return merged;
  }
  /**
   * Enriches a payment payload by calling registered extension hooks.
   * Invokes enrichPaymentPayload for every registered extension, then merges
   * server-declared extension fields back into the result.
   *
   * @param paymentPayload - The payment payload to enrich with extension data
   * @param paymentRequired - The PaymentRequired response containing extension declarations
   * @returns The enriched payment payload with extension data applied
   */
  async enrichPaymentPayloadWithExtensions(paymentPayload, paymentRequired) {
    if (this.registeredExtensions.size === 0) {
      return paymentPayload;
    }
    let enriched = paymentPayload;
    for (const [, extension] of this.registeredExtensions) {
      if (extension.enrichPaymentPayload) {
        enriched = await extension.enrichPaymentPayload(enriched, paymentRequired);
      }
    }
    return {
      ...enriched,
      extensions: this.mergeExtensions(paymentRequired.extensions, enriched.extensions)
    };
  }
  /**
   * Selects appropriate payment requirements based on registered clients and policies.
   *
   * Selection process:
   * 1. Filter by registered schemes (network + scheme support)
   * 2. Drop accepts with unrecognized `extra.paymentFlow`
   * 3. Enforce spend controls (allowlist, per-asset caps, USD cap on default assets)
   * 4. Apply all registered policies in order
   * 5. Prefer authorization (omit or explicit) over upfront/escrow when both remain
   * 6. Use selector to choose final requirement
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - Array of available payment requirements
   * @returns The selected payment requirements
   */
  selectPaymentRequirements(x402Version2, paymentRequirements) {
    const clientSchemesByNetwork = this.registeredClientSchemes.get(x402Version2);
    if (!clientSchemesByNetwork) {
      throw new Error(`No client registered for x402 version: ${x402Version2}`);
    }
    const supportedPaymentRequirements = paymentRequirements.filter((requirement) => {
      let clientSchemes = findSchemesByNetwork(clientSchemesByNetwork, requirement.network);
      if (!clientSchemes) {
        return false;
      }
      return clientSchemes.has(requirement.scheme);
    });
    if (supportedPaymentRequirements.length === 0) {
      throw new Error(`No network/scheme registered for x402 version: ${x402Version2} which comply with the payment requirements. ${JSON.stringify({
        x402Version: x402Version2,
        paymentRequirements,
        x402Versions: Array.from(this.registeredClientSchemes.keys()),
        networks: Array.from(clientSchemesByNetwork.keys()),
        schemes: Array.from(clientSchemesByNetwork.values()).map((schemes) => Array.from(schemes.keys())).flat()
      })}`);
    }
    const recognizedFlowRequirements = supportedPaymentRequirements.filter((requirement) => {
      const flow = requirement.extra?.paymentFlow;
      return flow == null || flow === "authorization" || flow === "upfront" || flow === "escrow";
    });
    if (recognizedFlowRequirements.length === 0) {
      throw new Error(
        `No payment requirements with a recognized paymentFlow for x402 version: ${x402Version2}`
      );
    }
    let filteredRequirements = this.applySpendControls(
      x402Version2,
      recognizedFlowRequirements,
      clientSchemesByNetwork
    );
    for (const policy of this.policies) {
      filteredRequirements = policy(x402Version2, filteredRequirements);
      if (filteredRequirements.length === 0) {
        throw new Error(`All payment requirements were filtered out by policies for x402 version: ${x402Version2}`);
      }
    }
    const authorizationAccepts = filteredRequirements.filter(
      (requirement) => requirement.extra?.paymentFlow == null || requirement.extra?.paymentFlow === "authorization"
    );
    if (authorizationAccepts.length > 0) {
      filteredRequirements = authorizationAccepts;
    }
    return this.paymentRequirementsSelector(x402Version2, filteredRequirements);
  }
  /**
   * Filter by spend controls (default-asset allowlist → opt-in assets → caps).
   * Keeps any accept that fits so a mixed offer can still pay the affordable option.
   *
   * @param x402Version - Protocol version (v1 uses `maxAmountRequired`)
   * @param requirements - Post scheme/flow filter
   * @param clientSchemesByNetwork - Registered clients for this version
   * @returns Requirements that pass spend controls
   */
  applySpendControls(x402Version2, requirements, clientSchemesByNetwork) {
    const controls = this.spendControls;
    if (controls === false) {
      return requirements;
    }
    const rawAmountOf = (requirement) => x402Version2 === 1 ? requirement.maxAmountRequired : requirement.amount;
    const isAtomicAmount = (amount) => /^\d+$/.test(amount);
    const amountOf = (requirement) => BigInt(rawAmountOf(requirement));
    const schemeFor = (requirement) => findByNetworkAndScheme(
      clientSchemesByNetwork,
      requirement.scheme,
      requirement.network
    );
    const defaultAssetFor = (requirement) => schemeFor(requirement)?.findDefaultAsset?.(requirement.asset, requirement.network);
    const matchesAssetEntry = (entry, requirement) => {
      if (!networkMatchesPattern(entry.network, requirement.network)) {
        return false;
      }
      if (entry.asset.toLowerCase() === requirement.asset.toLowerCase()) {
        return true;
      }
      const defaultAsset = defaultAssetFor(requirement);
      return defaultAsset != null && defaultAsset.symbol.toLowerCase() === entry.asset.toLowerCase();
    };
    const assetEntries = controls.allowedAssets === true ? void 0 : controls.allowedAssets;
    const allowAnyAsset = controls.allowedAssets === true;
    const findAssetEntry = (requirement) => assetEntries?.find((entry) => matchesAssetEntry(entry, requirement));
    let filtered = allowAnyAsset ? requirements : requirements.filter((requirement) => {
      if (defaultAssetFor(requirement) != null) {
        return true;
      }
      return findAssetEntry(requirement) != null;
    });
    if (filtered.length === 0) {
      throw new Error(
        `All payment requirements were rejected by spendControls: only default assets or entries in spendControls.allowedAssets are allowed. Add an allowedAssets entry for non-default tokens, set allowedAssets: true, or set spendControls: false.`
      );
    }
    const usdLimit = controls.maxAmountPerPayment === false ? false : controls.maxAmountPerPayment ?? DEFAULT_MAX_AMOUNT_PER_PAYMENT;
    const beforeAmountCaps = filtered;
    let rejectedByAssetCap = false;
    let rejectedUsdSymbol;
    filtered = filtered.filter((requirement) => {
      const assetEntry = findAssetEntry(requirement);
      if (assetEntry?.maxAmountPerPayment != null) {
        if (!isAtomicAmount(assetEntry.maxAmountPerPayment)) {
          throw new Error(
            `spendControls.allowedAssets[].maxAmountPerPayment must be an integer atomic amount, not a dollar value; got ${JSON.stringify(assetEntry.maxAmountPerPayment)}`
          );
        }
        if (!isAtomicAmount(rawAmountOf(requirement))) {
          rejectedByAssetCap = true;
          return false;
        }
        const ok2 = amountOf(requirement) <= BigInt(assetEntry.maxAmountPerPayment);
        if (!ok2) rejectedByAssetCap = true;
        return ok2;
      }
      const defaultAsset = defaultAssetFor(requirement);
      if (!defaultAsset) {
        return true;
      }
      if (usdLimit === false) {
        return true;
      }
      const rawAmount = rawAmountOf(requirement);
      if (!isAtomicAmount(rawAmount)) {
        const valueScaled = BigInt(convertToTokenAmount(rawAmount, 18));
        const capScaled = BigInt(convertToTokenAmount(parseMoney(usdLimit).amount, 18));
        const ok2 = valueScaled <= capScaled;
        if (!ok2) rejectedUsdSymbol = defaultAsset.symbol;
        return ok2;
      }
      const maxAtomic = BigInt(
        convertToTokenAmount(parseMoney(usdLimit).amount, defaultAsset.decimals)
      );
      const ok = amountOf(requirement) <= maxAtomic;
      if (!ok) rejectedUsdSymbol = defaultAsset.symbol;
      return ok;
    });
    if (filtered.length === 0) {
      if (rejectedByAssetCap && beforeAmountCaps.every((requirement) => {
        const entry = findAssetEntry(requirement);
        return entry?.maxAmountPerPayment != null;
      })) {
        throw new Error(
          `All payment requirements were rejected by spendControls.allowedAssets maxAmountPerPayment. Raise the per-asset cap, or omit maxAmountPerPayment to allow uncapped (default assets then fall back to the top-level USD cap).`
        );
      }
      throw new Error(
        `All payment requirements were rejected by spendControls.maxAmountPerPayment (${String(usdLimit)}${rejectedUsdSymbol ? `, including ${rejectedUsdSymbol}` : ""}). Raise maxAmountPerPayment, set it to false to disable, set allowedAssets[].maxAmountPerPayment for a per-asset atomic cap, or set spendControls: false to disable all spend controls.`
      );
    }
    return filtered;
  }
  /**
   * Internal method to register a scheme client.
   *
   * @param x402Version - The x402 protocol version
   * @param network - The network to register the client for
   * @param client - The scheme network client to register
   * @returns The x402Client instance for chaining
   */
  _registerScheme(x402Version2, network, client) {
    if (!this.registeredClientSchemes.has(x402Version2)) {
      this.registeredClientSchemes.set(x402Version2, /* @__PURE__ */ new Map());
    }
    const clientSchemesByNetwork = this.registeredClientSchemes.get(x402Version2);
    if (!clientSchemesByNetwork.has(network)) {
      clientSchemesByNetwork.set(network, /* @__PURE__ */ new Map());
    }
    const clientByScheme = clientSchemesByNetwork.get(network);
    clientByScheme.set(client.scheme, client);
    if (!this.schemeClientHookAdapters.has(x402Version2)) {
      this.schemeClientHookAdapters.set(x402Version2, /* @__PURE__ */ new Map());
    }
    const adaptersByNetwork = this.schemeClientHookAdapters.get(x402Version2);
    if (!adaptersByNetwork.has(network)) {
      adaptersByNetwork.set(network, /* @__PURE__ */ new Map());
    }
    const adaptersByScheme = adaptersByNetwork.get(network);
    const hooks = client.schemeHooks;
    if (!hooks) {
      adaptersByScheme.delete(client.scheme);
      return this;
    }
    const handles = {};
    if (hooks.onBeforePaymentCreation) {
      handles.beforePaymentCreation = hooks.onBeforePaymentCreation;
    }
    if (hooks.onAfterPaymentCreation) {
      handles.afterPaymentCreation = hooks.onAfterPaymentCreation;
    }
    if (hooks.onPaymentCreationFailure) {
      handles.onPaymentCreationFailure = hooks.onPaymentCreationFailure;
    }
    if (hooks.onPaymentResponse) {
      handles.onPaymentResponse = hooks.onPaymentResponse;
    }
    if (Object.keys(handles).length > 0) {
      adaptersByScheme.set(client.scheme, handles);
    } else {
      adaptersByScheme.delete(client.scheme);
    }
    return this;
  }
  /**
   * Returns manual hooks followed by the selected scheme hook and declared extension hooks.
   *
   * @param phase - Hook slot to collect
   * @param x402Version - Protocol version for the selected requirement
   * @param requirements - Selected payment requirement
   * @param declaredExtensions - Extension declarations that scope extension hooks
   * @returns Hooks in invocation order
   */
  getLabeledHooks(phase, x402Version2, requirements, declaredExtensions) {
    let manual;
    switch (phase) {
      case "beforePaymentCreation":
        manual = this.beforePaymentCreationHooks;
        break;
      case "afterPaymentCreation":
        manual = this.afterPaymentCreationHooks;
        break;
      case "onPaymentCreationFailure":
        manual = this.onPaymentCreationFailureHooks;
        break;
      case "onPaymentResponse":
        manual = this.paymentResponseHooks;
        break;
    }
    const out = [...manual];
    const adaptersByNetwork = this.schemeClientHookAdapters.get(x402Version2);
    const schemeAdapter = adaptersByNetwork ? findByNetworkAndScheme(adaptersByNetwork, requirements.scheme, requirements.network) : void 0;
    const hook = schemeAdapter?.[phase];
    if (hook !== void 0) {
      out.push(hook);
    }
    if (!declaredExtensions) {
      return out;
    }
    const extensionHookKey = this.getClientExtensionHookKey(phase);
    for (const [extensionKey, extension] of this.registeredExtensions) {
      if (!(extensionKey in declaredExtensions)) continue;
      const extensionHook = extension.hooks?.[extensionHookKey];
      if (!extensionHook) continue;
      out.push((async (ctx) => {
        return extensionHook(declaredExtensions[extensionKey], ctx);
      }));
    }
    return out;
  }
  /**
   * Maps internal hook phases to extension hook names.
   *
   * @param phase - Internal hook phase
   * @returns Extension hook key for the phase
   */
  getClientExtensionHookKey(phase) {
    switch (phase) {
      case "beforePaymentCreation":
        return "onBeforePaymentCreation";
      case "afterPaymentCreation":
        return "onAfterPaymentCreation";
      case "onPaymentCreationFailure":
        return "onPaymentCreationFailure";
      case "onPaymentResponse":
        return "onPaymentResponse";
    }
  }
};
function mergeArraysUnique(client, server) {
  const merged = [];
  for (const item of [...client, ...server]) {
    if (!merged.some((existing) => deepEqual(existing, item))) {
      merged.push(item);
    }
  }
  return merged;
}

// src/client/index.ts
var nativeFetch = globalThis.fetch.bind(globalThis);
function mppIntent(header) {
  return header?.match(/intent="([^"]+)"/)?.[1];
}
function resourceUrl(input) {
  return input instanceof Request ? input.url : String(input);
}
function withAuthorization(input, init, value) {
  const headers = new Headers(input instanceof Request ? input.headers : void 0);
  new Headers(init?.headers).forEach((headerValue, name) => headers.set(name, headerValue));
  headers.set("Authorization", value);
  return { ...init, headers };
}
function createPayKitClient(options) {
  const accept = options.accept ?? ["x402", "mpp"];
  const acceptsX402 = accept.includes("x402");
  const acceptsMpp = accept.includes("mpp");
  const onProgress = options.onProgress;
  let http;
  if (acceptsX402) {
    const svm = { rpcUrl: options.rpcUrl };
    const client = new x402Client();
    if (options.spendControls !== void 0) {
      client.setSpendControls(options.spendControls);
    }
    client.register("solana:*", new ExactSvmScheme(options.signer, svm));
    client.register("solana:*", new UptoSvmScheme(options.signer, svm));
    http = new x402HTTPClient(client);
  }
  let chargeMppx;
  const subscriptionCredentials = /* @__PURE__ */ new Map();
  const forward = onProgress ? (event) => onProgress(event) : void 0;
  const chargeClient = () => chargeMppx ??= Mppx.create({
    methods: [solana.charge({ onProgress: forward, rpcUrl: options.rpcUrl, signer: options.signer })]
  });
  const subscriptionClient = (resource) => Mppx.create({
    methods: [
      solana.subscription({
        onAuthentication: (access) => {
          subscriptionCredentials.set(resource, serializeSubscriptionAccessCredential(access));
        },
        onProgress: forward,
        rpcUrl: options.rpcUrl,
        signer: options.signer
      })
    ]
  });
  async function payFetch(input, init, protocol) {
    const resource = resourceUrl(input);
    const subscriptionCredential = subscriptionCredentials.get(resource);
    const probe = subscriptionCredential ? await nativeFetch(input, withAuthorization(input, init, subscriptionCredential)) : await nativeFetch(input, init);
    if (probe.status !== 402) return probe;
    const useMpp = acceptsMpp && protocol !== "x402";
    const useX402 = acceptsX402 && protocol !== "mpp";
    if (useMpp && probe.headers.get("www-authenticate")) {
      const intent = mppIntent(probe.headers.get("www-authenticate"));
      if (intent === "session") {
        throw new ConfigurationError(
          "Session payments are streaming; use the dedicated session client (createSessionFetch), not client.fetch."
        );
      }
      const mppx = intent === "subscription" ? subscriptionClient(resource) : chargeClient();
      return await mppx.fetch(input, init);
    }
    if (useX402 && http && probe.headers.get("payment-required")) {
      const required = http.getPaymentRequiredResponse((name) => probe.headers.get(name));
      const requirement = required.accepts?.[0];
      onProgress?.({
        amount: requirement?.amount,
        currency: requirement?.asset,
        recipient: requirement?.payTo,
        type: "challenge"
      });
      onProgress?.({ type: "signing" });
      const payload = await http.createPaymentPayload(required);
      const payHeaders = http.encodePaymentSignatureHeader(payload);
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(payHeaders)) headers.set(name, value);
      onProgress?.({ type: "paying" });
      const response = await nativeFetch(input, { ...init, headers });
      if (response.ok) {
        try {
          const settle = http.getPaymentSettleResponse((name) => response.headers.get(name));
          onProgress?.({ signature: settle.transaction ?? "", type: "paid" });
        } catch {
        }
      }
      return response;
    }
    return probe;
  }
  return Promise.resolve({ fetch: payFetch });
}
export {
  createPayKitClient
};
//# sourceMappingURL=index.js.map