import {
  ASSOCIATED_TOKEN_PROGRAM,
  BASIS_POINTS_DENOMINATOR,
  BLOCKHASH_COMMITMENT,
  COMPUTE_BUDGET_PROGRAM,
  COMPUTE_BUDGET_PROGRAM_ADDRESS,
  ChallengeExpiredError,
  ChannelStatus,
  ConfigurationError,
  DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  DEFAULT_RPC_URLS,
  DEFAULT_SESSION_EXPIRES_AT,
  DemoSignerOnMainnetError,
  InvalidKeyError,
  InvalidProofError,
  LIGHTHOUSE_PROGRAM_ADDRESS,
  MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  MEMO_PROGRAM,
  MEMO_PROGRAM_ADDRESS,
  MixedCurrenciesError,
  OPEN_SLOT_WINDOW,
  PAYMENT_CHANNELS_PROGRAM_ADDRESS,
  PAYMENT_CHANNELS_PROGRAM_ID,
  PayKitError,
  PaymentRequiredError,
  ProtocolIncompatibleError,
  ProtocolNotSupportedError,
  SLOT_COMMITMENT,
  STATE_COMMITMENT,
  SUBSCRIPTIONS_INIT_AUTHORITY_DISCRIMINATOR,
  SUBSCRIPTIONS_PROGRAM,
  SUBSCRIPTIONS_SUBSCRIBE_DISCRIMINATOR,
  SUBSCRIPTIONS_TRANSFER_DISCRIMINATOR,
  SUBSCRIPTION_SIZE,
  SYSTEM_PROGRAM,
  SettlementCache,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  UnknownGateError,
  VOUCHER_MAGIC,
  buildDistributeInstruction,
  buildReclaimInstruction,
  buildSettleAndSealInstructions,
  charge,
  createRpcClient,
  decodePaymentSignatureHeader,
  decodeTransactionFromPayload,
  defaultTokenProgramForCurrency,
  deriveSubscriptionAuthorityPda,
  deriveSubscriptionPda,
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  encodeVoucherMessageBytes,
  encodeVoucherMessageLoose,
  fetchChannel,
  findEventAuthorityPda,
  findPaymentChannelPda,
  getDistributeInstruction,
  getOpenInstructionDataDecoder,
  getSettleAndSealInstruction,
  getStablecoinTokenProgram,
  getSubscriptionAuthorityDecoder,
  getSubscriptionDelegationDecoder,
  getTokenPayerFromTransaction,
  getTopUpInstructionDataDecoder,
  isOffCurveAddress,
  mapSubscriptionPeriodToHours,
  networkMatchesPattern,
  normalizeSignedVoucher,
  parseU64,
  resolveIdleTimeoutSeconds,
  resolveStablecoinMint,
  resolveStablecoinMint2,
  resolveTokenProgram,
  resolveUptoSvmMemo,
  resolveUptoSvmPaymentChannelConfig,
  session,
  stablecoinSymbolForCurrency,
  subscription,
  transactionMessageHash,
  validateIdleTimeoutOptions,
  validateNetwork,
  validateSvmAddress,
  verifyOpenTransaction,
  verifySessionAuthentication,
  verifySubscriptionAuthentication,
  verifyVoucherSignature,
  verifyVoucherSignature2,
  x402Version
} from "./chunk-ZY62KQAB.js";

// src/adapters/x402-upto.ts
import { createSolanaRpc as createSolanaRpc2, getBase58Decoder as getBase58Decoder2 } from "@solana/kit";

// ../mpp/dist/server/Charge.js
import { address, getBase64Codec as getBase64Codec2, getCompiledTransactionMessageDecoder, getTransactionDecoder as getTransactionDecoder2, isTransactionPartialSigner } from "@solana/kit";
import { findAssociatedTokenPda } from "@solana-program/token";
import { Method, Receipt, Store } from "mppx";

// ../mpp/dist/utils/transactions.js
import { getBase64Codec, getBase64EncodedWireTransaction, getSignatureFromTransaction, getTransactionDecoder } from "@solana/kit";
var LEGACY_TRANSACTION_ERROR = "legacy transactions are not supported; use a version 0 or version 1 message";
function assertVersionedTransactionMessage(message) {
  if (message.version === "legacy")
    throw new Error(LEGACY_TRANSACTION_ERROR);
}
var MISSING_TRANSACTION_VERSION_ERROR = "RPC did not report the transaction version";
var ACCEPTED_TRANSACTION_VERSIONS = [0, 1];
function assertReportedTransactionVersion(version) {
  if (version === "legacy")
    throw new Error(LEGACY_TRANSACTION_ERROR);
  if (version === void 0 || version === null)
    throw new Error(MISSING_TRANSACTION_VERSION_ERROR);
  if (typeof version !== "number" || !ACCEPTED_TRANSACTION_VERSIONS.includes(version)) {
    throw new Error(`transaction version ${JSON.stringify(version)} is not accepted; accepted versions: ${ACCEPTED_TRANSACTION_VERSIONS.join(", ")}`);
  }
}
function transactionSignatureFromBase64(transaction) {
  return getSignatureFromTransaction(getTransactionDecoder().decode(getBase64Codec().encode(transaction)));
}
async function coSignBase64Transaction(signer, clientTxBase64) {
  const txBytes = getBase64Codec().encode(clientTxBase64);
  const decoded = getTransactionDecoder().decode(txBytes);
  if (decoded.signatures[signer.address] === void 0) {
    throw new Error(`Signer ${signer.address} is not an expected signer for this transaction`);
  }
  const [signatureMap] = await signer.signTransactions([decoded]);
  const signature = signatureMap[signer.address];
  if (!signature) {
    throw new Error(`Signer ${signer.address} did not return a signature`);
  }
  const cosigned = {
    ...decoded,
    signatures: Object.freeze({ ...decoded.signatures, [signer.address]: signature })
  };
  return getBase64EncodedWireTransaction(cosigned);
}

// ../mpp/dist/server/html-assets.gen.js
var PAYMENT_UI_JS = `<script>"use strict";(()=>{var kt=1,zt=2,Ft=3,Gt=4,Wt=5,Vt=6,$t=7,Kt=8,Ht=9,Xt=10,Yt=-32700,Jt=-32603,Zt=-32602,jt=-32601,qt=-32600,Qt=-32016,en=-32015,tn=-32014,nn=-32013,rn=-32012,on=-32011,an=-32010,sn=-32009,cn=-32008,un=-32007,_n=-32006,dn=-32005,An=-32004,ln=-32003,Rn=-32002,En=-32001,le=28e5,Re=2800001,On=2800002,Be=2800003,ke=2800004,ze=2800005,Ee=2800006,Oe=2800007,ne=2800008,Ne=2800009,Fe=2800010,Ge=2800011,Nn=323e4,gn=32300001,Sn=3230002,In=3230003,mn=3230004,ge=361e4,Se=3610001,We=3610002,Ve=3610003,$e=3610004,Ke=3610005,He=3610006,fn=3610007,Xe=3611e3,Tn=3704e3,Cn=3704001,hn=3704002,pn=3704003,Dn=3704004,vn=4128e3,Ln=4128001,bn=4128002,wn=4615e3,yn=4615001,Mn=4615002,Un=4615003,Pn=4615004,xn=4615005,Bn=4615006,kn=4615007,zn=4615008,Fn=4615009,Gn=4615010,Wn=4615011,Vn=4615012,$n=4615013,Kn=4615014,Hn=4615015,Xn=4615016,Yn=4615017,Jn=4615018,Zn=4615019,jn=4615020,qn=4615021,Qn=4615022,er=4615023,tr=4615024,nr=4615025,rr=4615026,or=4615027,ar=4615028,ir=4615029,sr=4615030,cr=4615031,ur=4615032,_r=4615033,dr=4615034,Ar=4615035,lr=4615036,Rr=4615037,Er=4615038,Or=4615039,Nr=4615040,gr=4615041,Sr=4615042,Ir=4615043,mr=4615044,fr=4615045,Tr=4615046,Cr=4615047,hr=4615048,pr=4615049,Dr=4615050,vr=4615051,Lr=4615052,br=4615053,wr=4615054,yr=5508e3,Mr=5508001,Ur=5508002,Pr=5508003,xr=5508004,Br=5508005,kr=5508006,zr=5508007,Fr=5508008,Gr=5508009,Wr=5508010,Vr=5508011,$r=5663e3,Kr=5663001,Hr=5663002,Xr=5663003,Yr=5663004,Jr=5663005,Zr=5663006,jr=5663007,qr=5663008,Qr=5663009,eo=5663010,to=5663011,no=5663012,ro=5663013,oo=5663014,ao=5663015,io=5663016,so=5663017,co=5663018,uo=5663019,_o=5663020,Ao=705e4,lo=7050001,Ro=7050002,Eo=7050003,Oo=7050004,No=7050005,go=7050006,So=7050007,Io=7050008,mo=7050009,fo=7050010,To=7050011,Co=7050012,ho=7050013,po=7050014,Do=7050015,vo=7050016,Lo=7050017,bo=7050018,wo=7050019,yo=7050020,Mo=7050021,Uo=7050022,Po=7050023,xo=7050024,Bo=7050025,ko=7050026,zo=7050027,Fo=7050028,Go=7050029,Wo=7050030,Vo=7050031,$o=7050032,Ko=7050033,Ho=7050034,Xo=7050035,Yo=7050036,Ye=8078e3,Ie=8078001,Je=8078002,Ze=8078003,me=8078004,fe=8078005,Te=8078006,Jo=8078007,Zo=8078008,jo=8078009,qo=8078010,Qo=8078011,Ce=8078012,je=8078013,qe=8078014,ea=8078015,ta=8078016,na=8078017,ra=8078018,oa=8078019,Qe=8078020,et=8078021,aa=8078022,ia=81e5,sa=8100001,ca=8100002,ua=8100003,_a=819e4,da=8190001,Aa=8190002,la=8190003,Ra=8190004,Ea=99e5,Oa=9900001,Na=9900002,ga=9900003,Sa=9900004;function tt(e){return Array.isArray(e)?"%5B"+e.map(tt).join("%2C%20")+"%5D":typeof e=="bigint"?\`\${e}n\`:encodeURIComponent(String(e!=null&&Object.getPrototypeOf(e)===null?{...e}:e))}function Ia([e,t]){return\`\${e}=\${tt(t)}\`}function ma(e){let t=Object.entries(e).map(Ia).join("&");return btoa(t)}var ui={[Nn]:"Account not found at address: $address",[mn]:"Not all accounts were decoded. Encoded accounts found at addresses: $addresses.",[In]:"Expected decoded account at address: $address",[Sn]:"Failed to decode account data at address: $address",[gn]:"Accounts not found at addresses: $addresses",[Ne]:"Unable to find a viable program address bump seed.",[On]:"$putativeAddress is not a base58-encoded address.",[le]:"Expected base58 encoded address to decode to a byte array of length 32. Actual length: $actualLength.",[Be]:"The \`CryptoKey\` must be an \`Ed25519\` public key.",[Ge]:"$putativeOffCurveAddress is not a base58-encoded off-curve address.",[ne]:"Invalid seeds; point must fall off the Ed25519 curve.",[ke]:"Expected given program derived address to have the following format: [Address, ProgramDerivedAddressBump].",[Ee]:"A maximum of $maxSeeds seeds, including the bump seed, may be supplied when creating an address. Received: $actual.",[Oe]:"The seed at index $index with length $actual exceeds the maximum length of $maxSeedLength bytes.",[ze]:"Expected program derived address bump to be in the range [0, 255], got: $bump.",[Fe]:"Program address cannot end with PDA marker.",[Re]:"Expected base58-encoded address string of length in the range [32, 44]. Actual length: $actualLength.",[Gt]:"Expected base58-encoded blockash string of length in the range [32, 44]. Actual length: $actualLength.",[kt]:"The network has progressed past the last block for which this transaction could have been committed.",[Ye]:"Codec [$codecDescription] cannot decode empty byte arrays.",[aa]:"Enum codec cannot use lexical values [$stringValues] as discriminators. Either remove all lexical values or set \`useValuesAsDiscriminators\` to \`false\`.",[Qe]:"Sentinel [$hexSentinel] must not be present in encoded bytes [$hexEncodedBytes].",[fe]:"Encoder and decoder must have the same fixed size, got [$encoderFixedSize] and [$decoderFixedSize].",[Te]:"Encoder and decoder must have the same max size, got [$encoderMaxSize] and [$decoderMaxSize].",[me]:"Encoder and decoder must either both be fixed-size or variable-size.",[Zo]:"Enum discriminator out of range. Expected a number in [$formattedValidDiscriminators], got $discriminator.",[Je]:"Expected a fixed-size codec, got a variable-size one.",[je]:"Codec [$codecDescription] expected a positive byte length, got $bytesLength.",[Ze]:"Expected a variable-size codec, got a fixed-size one.",[oa]:"Codec [$codecDescription] expected zero-value [$hexZeroValue] to have the same size as the provided fixed-size item [$expectedSize bytes].",[Ie]:"Codec [$codecDescription] expected $expected bytes, got $bytesLength.",[ra]:"Expected byte array constant [$hexConstant] to be present in data [$hexData] at offset [$offset].",[jo]:"Invalid discriminated union variant. Expected one of [$variants], got $value.",[qo]:"Invalid enum variant. Expected one of [$stringValues] or a number in [$formattedNumericalValues], got $variant.",[ea]:"Invalid literal union variant. Expected one of [$variants], got $value.",[Jo]:"Expected [$codecDescription] to have $expected items, got $actual.",[Ce]:"Invalid value $value for base $base with alphabet $alphabet.",[ta]:"Literal union discriminator out of range. Expected a number between $minRange and $maxRange, got $discriminator.",[Qo]:"Codec [$codecDescription] expected number to be in the range [$min, $max], got $value.",[qe]:"Codec [$codecDescription] expected offset to be in the range [0, $bytesLength], got $offset.",[et]:"Expected sentinel [$hexSentinel] to be present in decoded bytes [$hexDecodedBytes].",[na]:"Union variant out of range. Expected an index between $minRange and $maxRange, got $variant.",[Xe]:"No random values implementation could be found.",[Fn]:"instruction requires an uninitialized account",[er]:"instruction tries to borrow reference for an account which is already borrowed",[tr]:"instruction left account with an outstanding borrowed reference",[qn]:"program other than the account's owner changed the size of the account data",[xn]:"account data too small for instruction",[Qn]:"instruction expected an executable account",[Tr]:"An account does not have enough lamports to be rent-exempt",[hr]:"Program arithmetic overflowed",[fr]:"Failed to serialize or deserialize account data: $encodedData",[wr]:"Builtin programs must consume compute units",[ur]:"Cross-program invocation call depth too deep",[Er]:"Computational budget exceeded",[rr]:"custom program error: #$code",[Yn]:"instruction contains duplicate accounts",[nr]:"instruction modifications of multiply-passed account differ",[sr]:"executable accounts must be rent exempt",[ar]:"instruction changed executable accounts data",[ir]:"instruction changed the balance of an executable account",[Jn]:"instruction changed executable bit of an account",[Kn]:"instruction modified data of an account it does not own",[$n]:"instruction spent from the balance of an account it does not own",[yn]:"generic instruction error",[Dr]:"Provided owner is not allowed",[Ir]:"Account is immutable",[mr]:"Incorrect authority provided",[kn]:"incorrect program id for instruction",[Bn]:"insufficient funds for instruction",[Pn]:"invalid account data for instruction",[Cr]:"Invalid account owner",[Mn]:"invalid program argument",[or]:"program returned invalid error code",[Un]:"invalid instruction data",[Rr]:"Failed to reallocate account data",[lr]:"Provided seeds do not result in a valid address",[vr]:"Accounts data allocations exceeded the maximum allowed per transaction",[Lr]:"Max accounts exceeded",[br]:"Max instruction trace length exceeded",[Ar]:"Length of the seed is too long for address generation",[_r]:"An account required by the instruction is missing",[zn]:"missing required signature for instruction",[Vn]:"instruction illegally modified the program id of an account",[jn]:"insufficient account keys for instruction",[Or]:"Cross-program invocation with unauthorized signer or writable account",[Nr]:"Failed to create program execution environment",[Sr]:"Program failed to compile",[gr]:"Program failed to complete",[Xn]:"instruction modified data of a read-only account",[Hn]:"instruction changed the balance of a read-only account",[dr]:"Cross-program invocation reentrancy not allowed for this instruction",[Zn]:"instruction modified rent epoch of an account",[Wn]:"sum of account balances before and after instruction do not match",[Gn]:"instruction requires an initialized account",[wn]:"",[cr]:"Unsupported program id",[pr]:"Unsupported sysvar",[vn]:"The instruction does not have any accounts.",[Ln]:"The instruction does not have any data.",[bn]:"Expected instruction to have progress address $expectedProgramAddress, got $actualProgramAddress.",[Wt]:"Expected base58 encoded blockhash to decode to a byte array of length 32. Actual length: $actualLength.",[zt]:"The nonce \`$expectedNonceValue\` is no longer valid. It has advanced to \`$actualNonceValue\`",[Na]:"Invariant violation: Found no abortable iterable cache entry for key \`$cacheKey\`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",[Sa]:"Invariant violation: This data publisher does not publish to the channel named \`$channelName\`. Supported channels include $supportedChannelNames.",[Oa]:"Invariant violation: WebSocket message iterator state is corrupt; iterated without first resolving existing message promise. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",[Ea]:"Invariant violation: WebSocket message iterator is missing state storage. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",[ga]:"Invariant violation: Switch statement non-exhaustive. Received unexpected value \`$unexpectedValue\`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",[Jt]:"JSON-RPC error: Internal JSON-RPC error ($__serverMessage)",[Zt]:"JSON-RPC error: Invalid method parameter(s) ($__serverMessage)",[qt]:"JSON-RPC error: The JSON sent is not a valid \`Request\` object ($__serverMessage)",[jt]:"JSON-RPC error: The method does not exist / is not available ($__serverMessage)",[Yt]:"JSON-RPC error: An error occurred on the server while parsing the JSON text ($__serverMessage)",[rn]:"$__serverMessage",[En]:"$__serverMessage",[An]:"$__serverMessage",[tn]:"$__serverMessage",[an]:"$__serverMessage",[sn]:"$__serverMessage",[Qt]:"Minimum context slot has not been reached",[dn]:"Node is unhealthy; behind by $numSlotsBehind slots",[cn]:"No snapshot",[Rn]:"Transaction simulation failed",[un]:"$__serverMessage",[on]:"Transaction history is not available from this node",[_n]:"$__serverMessage",[nn]:"Transaction signature length mismatch",[ln]:"Transaction signature verification failure",[en]:"$__serverMessage",[Tn]:"Key pair bytes must be of length 64, got $byteLength.",[Cn]:"Expected private key bytes with length 32. Actual length: $actualLength.",[hn]:"Expected base58-encoded signature to decode to a byte array of length 64. Actual length: $actualLength.",[Dn]:"The provided private key does not match the provided public key.",[pn]:"Expected base58-encoded signature string of length in the range [64, 88]. Actual length: $actualLength.",[Vt]:"Lamports value must be in the range [0, 2e64-1]",[$t]:"\`$value\` cannot be parsed as a \`BigInt\`",[Xt]:"$message",[Kt]:"\`$value\` cannot be parsed as a \`Number\`",[Ft]:"No nonce account could be found at address \`$nonceAccountAddress\`",[_a]:"The notification name must end in 'Notifications' and the API must supply a subscription plan creator function for the notification '$notificationName'.",[Aa]:"WebSocket was closed before payload could be added to the send buffer",[la]:"WebSocket connection closed",[Ra]:"WebSocket failed to connect",[da]:"Failed to obtain a subscription id from the server",[ua]:"Could not find an API plan for RPC method: \`$method\`",[ia]:"The $argumentLabel argument to the \`$methodName\` RPC method$optionalPathLabel was \`$value\`. This number is unsafe for use with the Solana JSON-RPC because it exceeds \`Number.MAX_SAFE_INTEGER\`.",[ca]:"HTTP error ($statusCode): $message",[sa]:"HTTP header(s) forbidden: $headers. Learn more at https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name.",[yr]:"Multiple distinct signers were identified for address \`$address\`. Please ensure that you are using the same signer instance for each address.",[Mr]:"The provided value does not implement the \`KeyPairSigner\` interface",[Pr]:"The provided value does not implement the \`MessageModifyingSigner\` interface",[xr]:"The provided value does not implement the \`MessagePartialSigner\` interface",[Ur]:"The provided value does not implement any of the \`MessageSigner\` interfaces",[kr]:"The provided value does not implement the \`TransactionModifyingSigner\` interface",[zr]:"The provided value does not implement the \`TransactionPartialSigner\` interface",[Fr]:"The provided value does not implement the \`TransactionSendingSigner\` interface",[Br]:"The provided value does not implement any of the \`TransactionSigner\` interfaces",[Gr]:"More than one \`TransactionSendingSigner\` was identified.",[Wr]:"No \`TransactionSendingSigner\` was identified. Please provide a valid \`TransactionWithSingleSendingSigner\` transaction.",[Vr]:"Wallet account signers do not support signing multiple messages/transactions in a single operation",[fn]:"Cannot export a non-extractable key.",[Se]:"No digest implementation could be found.",[ge]:"Cryptographic operations are only allowed in secure browser contexts. Read more here: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts.",[We]:\`This runtime does not support the generation of Ed25519 key pairs.

Install @solana/webcrypto-ed25519-polyfill and call its \\\`install\\\` function before generating keys in environments that do not support Ed25519.

For a list of runtimes that currently support Ed25519 operations, visit https://github.com/WICG/webcrypto-secure-curves/issues/20.\`,[Ve]:"No signature verification implementation could be found.",[$e]:"No key generation implementation could be found.",[Ke]:"No signing implementation could be found.",[He]:"No key export implementation could be found.",[Ht]:"Timestamp value must be in the range [-(2n ** 63n), (2n ** 63n) - 1]. \`$value\` given",[vo]:"Transaction processing left an account with an outstanding borrowed reference",[lo]:"Account in use",[Ro]:"Account loaded twice",[Eo]:"Attempt to debit an account but found no record of a prior credit.",[Po]:"Transaction loads an address table account that doesn't exist",[So]:"This transaction has already been processed",[Io]:"Blockhash not found",[mo]:"Loader call chain is too deep",[Do]:"Transactions are currently disabled due to cluster maintenance",[Wo]:"Transaction contains a duplicate instruction ($index) that is not allowed",[No]:"Insufficient funds for fee",[Vo]:"Transaction results in an account ($accountIndex) with insufficient funds for rent",[go]:"This account may not be used to pay transaction fees",[To]:"Transaction contains an invalid account reference",[Bo]:"Transaction loads an address table account with invalid data",[ko]:"Transaction address table lookup uses an invalid index",[xo]:"Transaction loads an address table account with an invalid owner",[Ko]:"LoadedAccountsDataSizeLimit set for transaction must be greater than 0.",[ho]:"This program may not be used for executing instructions",[zo]:"Transaction leaves an account with a lower balance than rent-exempt minimum",[wo]:"Transaction loads a writable account that cannot be written",[$o]:"Transaction exceeded max loaded accounts data size cap",[fo]:"Transaction requires a fee but has no signature present",[Oo]:"Attempt to load a program that does not exist",[Xo]:"Execution of the program referenced by account at index $accountIndex is temporarily restricted.",[Ho]:"ResanitizationNeeded",[po]:"Transaction failed to sanitize accounts offsets correctly",[Co]:"Transaction did not pass signature verification",[Uo]:"Transaction locked too many accounts",[Yo]:"Sum of account balances before and after transaction do not match",[Ao]:"The transaction failed with the error \`$errorName\`",[bo]:"Transaction version is unsupported",[Mo]:"Transaction would exceed account data limit within the block",[Go]:"Transaction would exceed total account data limit",[yo]:"Transaction would exceed max account limit within the block",[Lo]:"Transaction would exceed max Block Cost Limit",[Fo]:"Transaction would exceed max Vote Cost Limit",[ao]:"Attempted to sign a transaction with an address that is not a signer for it",[eo]:"Transaction is missing an address at index: $index.",[io]:"Transaction has no expected signers therefore it cannot be encoded",[_o]:"Transaction size $transactionSize exceeds limit of $transactionSizeLimit bytes",[Hr]:"Transaction does not have a blockhash lifetime",[Xr]:"Transaction is not a durable nonce transaction",[Jr]:"Contents of these address lookup tables unknown: $lookupTableAddresses",[Zr]:"Lookup of address at index $highestRequestedIndex failed for lookup table \`$lookupTableAddress\`. Highest known index is $highestKnownIndex. The lookup table may have been extended since its contents were retrieved",[qr]:"No fee payer set in CompiledTransaction",[jr]:"Could not find program address at index $index",[co]:"Failed to estimate the compute unit consumption for this transaction message. This is likely because simulating the transaction failed. Inspect the \`cause\` property of this error to learn more",[uo]:"Transaction failed when it was simulated in order to estimate the compute unit consumption. The compute unit estimate provided is for a transaction that failed when simulated and may not be representative of the compute units this transaction would consume if successful. Inspect the \`cause\` property of this error to learn more",[to]:"Transaction is missing a fee payer.",[no]:"Could not determine this transaction's signature. Make sure that the transaction has been signed by its fee payer.",[oo]:"Transaction first instruction is not advance nonce account instruction.",[ro]:"Transaction with no instructions cannot be durable nonce transaction.",[$r]:"This transaction includes an address (\`$programAddress\`) which is both invoked and set as the fee payer. Program addresses may not pay fees",[Kr]:"This transaction includes an address (\`$programAddress\`) which is both invoked and marked writable. Program addresses may not be writable",[so]:"The transaction message expected the transaction to have $signerAddressesLength signatures, got $signaturesLength.",[Qr]:"Transaction is missing signatures for addresses: $addresses.",[Yr]:"Transaction version must be in the range [0, 127]. \`$actualVersion\` given"};function fa(e,t={}){{let n=\`Solana error #\${e}; Decode this error by running \\\`npx @solana/errors decode -- \${e}\`;return Object.keys(t).length&&(n+=\` '\${ma(t)}'\`),\`\${n}\\\`\`}}function nt(e,t){return e instanceof Error&&e.name==="SolanaError"?t!==void 0?e.context.__code===t:!0:!1}var S=class extends Error{cause=this.cause;context;constructor(...[e,t]){let n,r;if(t){let{cause:a,...i}=t;a&&(r={cause:a}),Object.keys(i).length>0&&(n=i)}let o=fa(e,n);super(o,r),this.context={__code:e,...n},this.name="SolanaError"}};var Ta=(e,t)=>{if(e.length>=t)return e;let n=new Uint8Array(t).fill(0);return n.set(e),n},Ca=(e,t)=>Ta(e.length<=t?e:e.slice(0,t),t);function ha(e,t){return"fixedSize"in t?t.fixedSize:t.getSizeFromValue(e)}function re(e){return Object.freeze({...e,encode:t=>{let n=new Uint8Array(ha(t,e));return e.write(t,n,0),n}})}function he(e){return Object.freeze({...e,decode:(t,n=0)=>e.read(t,n)[0]})}function k(e){return"fixedSize"in e&&typeof e.fixedSize=="number"}function pa(e){return!k(e)}function oe(e,t){if(k(e)!==k(t))throw new S(me);if(k(e)&&k(t)&&e.fixedSize!==t.fixedSize)throw new S(fe,{decoderFixedSize:t.fixedSize,encoderFixedSize:e.fixedSize});if(!k(e)&&!k(t)&&e.maxSize!==t.maxSize)throw new S(Te,{decoderMaxSize:t.maxSize,encoderMaxSize:e.maxSize});return{...t,...e,decode:t.decode,encode:e.encode,read:t.read,write:e.write}}function Da(e,t,n,r=0){let o=n.length-r;if(o<t)throw new S(Ie,{bytesLength:o,codecDescription:e,expected:t})}function rt(e,t){return re({fixedSize:t,write:(n,r,o)=>{let a=e.encode(n),i=a.length>t?a.slice(0,t):a;return r.set(i,o),o+t}})}function ot(e,t){return he({fixedSize:t,read:(n,r)=>{Da("fixCodecSize",t,n,r),(r>0||n.length>t)&&(n=n.slice(r,r+t)),k(e)&&(n=Ca(n,e.fixedSize));let[o]=e.read(n,0);return[o,r+t]}})}function pe(e,t){return re({...pa(e)?{...e,getSizeFromValue:n=>e.getSizeFromValue(t(n))}:e,write:(n,r,o)=>e.write(t(n),r,o)})}function va(e,t,n=t){if(!t.match(new RegExp(\`^[\${e}]*$\`)))throw new S(Ce,{alphabet:e,base:e.length,value:n})}var La=e=>re({getSizeFromValue:t=>{let[n,r]=at(t,e[0]);if(!r)return t.length;let o=it(r,e);return n.length+Math.ceil(o.toString(16).length/2)},write(t,n,r){if(va(e,t),t==="")return r;let[o,a]=at(t,e[0]);if(!a)return n.set(new Uint8Array(o.length).fill(0),r),r+o.length;let i=it(a,e),u=[];for(;i>0n;)u.unshift(Number(i%256n)),i/=256n;let c=[...Array(o.length).fill(0),...u];return n.set(c,r),r+c.length}}),ba=e=>he({read(t,n){let r=n===0?t:t.slice(n);if(r.length===0)return["",0];let o=r.findIndex(c=>c!==0);o=o===-1?r.length:o;let a=e[0].repeat(o);if(o===r.length)return[a,t.length];let i=r.slice(o).reduce((c,A)=>c*256n+BigInt(A),0n),u=wa(i,e);return[a+u,t.length]}});function at(e,t){let[n,r]=e.split(new RegExp(\`((?!\${t}).*)\`));return[n,r]}function it(e,t){let n=BigInt(t.length),r=0n;for(let o of e)r*=n,r+=BigInt(t.indexOf(o));return r}function wa(e,t){let n=BigInt(t.length),r=[];for(;e>0n;)r.unshift(t[Number(e%n)]),e/=n;return r.join("")}var st="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",ct=()=>La(st),ut=()=>ba(st);var Oi=globalThis.TextDecoder,Ni=globalThis.TextEncoder;function ya(){if(!globalThis.isSecureContext)throw new S(ge)}function _t(){if(ya(),typeof globalThis.crypto>"u"||typeof globalThis.crypto.subtle?.digest!="function")throw new S(Se)}var De,ve;function Rt(){return De||(De=ct()),De}function Ma(){return ve||(ve=ut()),ve}function Ua(e){if(e.length<32||e.length>44)throw new S(Re,{actualLength:e.length});let r=Rt().encode(e).byteLength;if(r!==32)throw new S(le,{actualLength:r})}function J(e){return Ua(e),e}function Z(){return pe(rt(Rt(),32),e=>J(e))}function Et(){return ot(Ma(),32)}function Pa(){return oe(Z(),Et())}var xa=37095705934669439343138083508754565189542113879843219016388785533085940283555n,m=57896044618658097711785492504343953926634992332820282019728792003956564819949n,dt=19681161376707505956807079304988542015446066515923890162744021073123829784752n;function v(e){let t=e%m;return t>=0n?t:m+t}function w(e,t){let n=e;for(;t-- >0n;)n*=n,n%=m;return n}function Ba(e){let n=e*e%m*e%m,r=w(n,2n)*n%m,o=w(r,1n)*e%m,a=w(o,5n)*o%m,i=w(a,10n)*a%m,u=w(i,20n)*i%m,c=w(u,40n)*u%m,A=w(c,80n)*c%m,O=w(A,80n)*c%m,l=w(O,10n)*a%m;return w(l,2n)*e%m}function ka(e,t){let n=v(t*t*t),r=v(n*n*t),o=Ba(e*r),a=v(e*n*o),i=v(t*a*a),u=a,c=v(a*dt),A=i===e,O=i===v(-e),l=i===v(-e*dt);return A&&(a=u),(O||l)&&(a=c),(v(a)&1n)===1n&&(a=v(-a)),!A&&!O?null:a}function za(e,t){let n=v(e*e),r=v(n-1n),o=v(xa*n+1n),a=ka(r,o);if(a===null)return!1;let i=(t&128)!==0;return!(a===0n&&i)}function Fa(e){let t=e.toString(16);return t.length===1?\`0\${t}\`:t}function Ga(e){let n=\`0x\${e.reduce((r,o,a)=>\`\${Fa(a===31?o&-129:o)}\${r}\`,"")}\`;return BigInt(n)}function Wa(e){if(e.byteLength!==32)return!1;let t=Ga(e);return za(t,e[31])}var At=32,lt=16,Va=[80,114,111,103,114,97,109,68,101,114,105,118,101,100,65,100,100,114,101,115,115];async function $a({programAddress:e,seeds:t}){if(_t(),t.length>lt)throw new S(Ee,{actual:t.length,maxSeeds:lt});let n,r=t.reduce((c,A,O)=>{let l=typeof A=="string"?(n||=new TextEncoder).encode(A):A;if(l.byteLength>At)throw new S(Oe,{actual:l.byteLength,index:O,maxSeedLength:At});return c.push(...l),c},[]),o=Pa(),a=o.encode(e),i=await crypto.subtle.digest("SHA-256",new Uint8Array([...r,...a,...Va])),u=new Uint8Array(i);if(Wa(u))throw new S(ne);return o.decode(u)}async function Ot({programAddress:e,seeds:t}){let n=255;for(;n>0;)try{return[await $a({programAddress:e,seeds:[...t,new Uint8Array([n])]}),n]}catch(r){if(nt(r,ne))n--;else throw r}throw new S(Ne)}async function Nt(e,t={}){let{programAddress:n="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"}=t;return await Ot({programAddress:n,seeds:[Z().encode(e.owner),Z().encode(e.tokenProgram),Z().encode(e.mint)]})}var Ka=function(e,t,n,r){if(n==="a"&&!r)throw new TypeError("Private accessor was defined without a getter");if(typeof t=="function"?e!==t||!r:!t.has(e))throw new TypeError("Cannot read private member from an object whose class did not declare it");return n==="m"?r:n==="a"?r.call(e):r?r.value:t.get(e)},Ha=function(e,t,n,r,o){if(r==="m")throw new TypeError("Private method is not writable");if(r==="a"&&!o)throw new TypeError("Private accessor was defined without a setter");if(typeof t=="function"?e!==t||!o:!t.has(e))throw new TypeError("Cannot write private member to an object whose class did not declare it");return r==="a"?o.call(e,n):o?o.value=n:t.set(e,n),n},ae,j,ie=new Set;function Xa(e){q=void 0,ie.add(e)}function Ya(e){q=void 0,ie.delete(e)}var K={};function It(){if(j||(j=Object.freeze({register:gt,get:Ja,on:Za}),typeof window>"u"))return j;let e=Object.freeze({register:gt});try{window.addEventListener("wallet-standard:register-wallet",({detail:t})=>t(e))}catch(t){console.error(\`wallet-standard:register-wallet event listener could not be added
\`,t)}try{window.dispatchEvent(new Le(e))}catch(t){console.error(\`wallet-standard:app-ready event could not be dispatched
\`,t)}return j}function gt(...e){return e=e.filter(t=>!ie.has(t)),e.length?(e.forEach(t=>Xa(t)),K.register?.forEach(t=>St(()=>t(...e))),function(){e.forEach(n=>Ya(n)),K.unregister?.forEach(n=>St(()=>n(...e)))}):()=>{}}var q;function Ja(){return q||(q=[...ie]),q}function Za(e,t){return K[e]?.push(t)||(K[e]=[t]),function(){K[e]=K[e]?.filter(r=>t!==r)}}function St(e){try{e()}catch(t){console.error(t)}}var Le=class extends Event{get detail(){return Ka(this,ae,"f")}get type(){return"wallet-standard:app-ready"}constructor(t){super("wallet-standard:app-ready",{bubbles:!1,cancelable:!1,composed:!1}),ae.set(this,void 0),Ha(this,ae,t,"f")}preventDefault(){throw new Error("preventDefault cannot be called")}stopImmediatePropagation(){throw new Error("stopImmediatePropagation cannot be called")}stopPropagation(){throw new Error("stopPropagation cannot be called")}};ae=new WeakMap;var Tt=document.getElementById("__MPPX_DATA__")??document.getElementById("__MPP_DATA__");if(!Tt?.textContent)throw new Error("Missing embedded data element");var ce=JSON.parse(Tt.textContent),mt=Object.values(ce).filter(e=>e?.challenge!==void 0),ee=ce.challenge!==void 0?ce:mt.find(e=>e.label==="solana")??mt[0]??ce,we=typeof ee.challenge?.request=="object",d=ee.challenge,I=we?d.request:JSON.parse(atob(d.request.replace(/-/g,"+").replace(/_/g,"/"))),f=I.methodDetails??{},y=f.network??ee.network??"mainnet-beta",Ct=we?Me(JSON.stringify(d.request)):d.request,ht=y==="devnet"||y==="localnet",ye=document.getElementById("root");if(!ye)throw new Error("Missing #root");var ja='<svg width="20" height="20" viewBox="0 0 397 312" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:8px"><defs><linearGradient id="sg" x1="360" y1="11" x2="141" y2="310" gradientUnits="userSpaceOnUse"><stop stop-color="#00FFA3"/><stop offset="1" stop-color="#DC1FFF"/></linearGradient></defs><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sg)"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sg)"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sg)"/></svg>',C=document.createElement("button"),qa=ht?\`<span style="font-size:10px;font-weight:500;background:var(--mppx-surface, #f5f5f5);color:var(--mppx-muted, #666);padding:2px 6px;border-radius:4px;margin-left:8px">\${y}</span>\`:"";C.innerHTML=\`\${ja} Continue with Solana\${qa}\`;C.setAttribute("style",["display:flex","align-items:center","justify-content:center","width:100%","padding:14px 24px","border:none","border-radius:var(--mppx-radius, 8px)","font-size:16px","font-weight:600","cursor:pointer","font-family:inherit","background:var(--mppx-accent, #000)","color:var(--mppx-background, #fff)","transition:opacity 0.15s"].join(";"));C.onmouseenter=()=>{C.style.opacity="0.85"};C.onmouseleave=()=>{C.style.opacity="1"};var h=document.createElement("div");h.setAttribute("style","text-align:center;font-size:13px;margin-top:8px;color:var(--mppx-muted, #666);min-height:20px");ye.appendChild(C);ye.appendChild(h);C.onclick=async()=>{C.disabled=!0,C.style.opacity="0.6",C.style.cursor="wait";try{ht?await ti():await Qa()}catch(e){console.error("[pay.sh] Payment error:",e),h.textContent=e.message??"Payment failed",h.style.color="var(--mppx-negative, #e53e3e)",C.disabled=!1,C.style.opacity="1",C.style.cursor="pointer"}};async function Qa(){h.textContent="Looking for wallets...";let{get:e,on:t}=It(),n=e();n.length===0&&await new Promise(T=>{let V=t("register",()=>{n=e(),n.length>0&&(V(),T())});setTimeout(()=>{V(),T()},2e3)});let r=n.filter(T=>T.chains?.some(V=>V.startsWith("solana:")));if(r.length===0)throw new Error("No Solana wallet found. Install Phantom, Solflare, or another Solana wallet.");let o;r.length===1?o=r[0]:o=await ei(r),h.textContent=\`Connecting to \${o.name}...\`;let a=o.features["standard:connect"];if(!a)throw new Error(\`\${o.name} doesn't support connect\`);let{accounts:i}=await a.connect();if(!i||i.length===0)throw new Error("No accounts returned");let u=i[0],c=new Uint8Array(u.publicKey),A=vt(c);h.textContent="Building transaction...";let O=Lt(y),l=Ue(I.currency,y),M=l===null,L=f.tokenProgram??bt(I.currency,y),b=f.recentBlockhash??(await Q(O,"getLatestBlockhash",[{commitment:"confirmed"}])).value.blockhash,P=_(b),F=BigInt(I.amount),N=f.splits??[],R=0n;for(let T of N)R+=BigInt(T.amount);let G=F-R,x=_(I.recipient),p=f.feePayer===!0&&!!f.feePayerKey,s=p?_(f.feePayerKey):c,g=p?s:c,E=wt();if(M){E.push(ue(c,x,G)),z(E,I.externalId);for(let T of N)E.push(ue(c,_(T.recipient),BigInt(T.amount))),z(E,T.memo)}else{let T=_(l),V=f.decimals??6,Pe=_(await H(A,l,L)),xt=_(await H(I.recipient,l,L));E.push(_e(Pe,T,xt,c,G,V,L)),z(E,I.externalId);for(let Y of N){let Bt=_(Y.recipient),xe=_(await H(Y.recipient,l,L));Mt(p,Y)&&E.push(yt(g,xe,Bt,T,L)),E.push(_e(Pe,T,xe,c,BigInt(Y.amount),V,L)),z(E,Y.memo)}}let B=Ut(E,s,c,P),D=p?2:1,$=new Uint8Array(1+D*64+B.length);$[0]=D,$.set(B,1+D*64),h.textContent=\`Waiting for \${o.name} to sign...\`;let X=o.features["solana:signTransaction"];if(!X)throw new Error(\`\${o.name} doesn't support signTransaction\`);let[{signedTransaction:de}]=await X.signTransaction({account:u,transaction:$,chain:\`solana:\${y}\`});h.textContent="Submitting payment...";let W=btoa(String.fromCharCode(...new Uint8Array(de))),Ae=Ct,te={challenge:{id:d.id,intent:d.intent,method:d.method,realm:d.realm,request:Ae,...d.expires&&{expires:d.expires},...d.description&&{description:d.description}},payload:{transaction:W,type:"transaction"}},Pt=Me(JSON.stringify(te));await pt(\`Payment \${Pt}\`)}function ei(e){return new Promise(t=>{let n=document.createElement("div");n.setAttribute("style","position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999");let r=document.createElement("div");r.setAttribute("style","background:var(--mppx-background, #fff);border-radius:var(--mppx-radius, 8px);padding:24px;max-width:320px;width:100%;font-family:inherit"),r.innerHTML='<div style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--mppx-foreground, #000)">Select a wallet</div>';for(let o of e){let a=document.createElement("button"),i=o.icon?\`<img src="\${o.icon}" width="24" height="24" style="border-radius:4px;margin-right:10px">\`:"";a.innerHTML=\`\${i}\${o.name}\`,a.setAttribute("style","display:flex;align-items:center;width:100%;padding:12px;margin-bottom:8px;border:1px solid var(--mppx-border, #e5e5e5);border-radius:var(--mppx-radius, 6px);background:var(--mppx-surface, #f5f5f5);color:var(--mppx-foreground, #000);font-size:15px;cursor:pointer;font-family:inherit"),a.onclick=()=>{n.remove(),t(o)},r.appendChild(a)}n.appendChild(r),n.onclick=o=>{o.target===n&&n.remove()},document.body.appendChild(n)})}async function ti(){h.textContent="Generating keypair...";let e=Lt(y),t=await crypto.subtle.generateKey("Ed25519",!0,["sign","verify"]),n=new Uint8Array(await crypto.subtle.exportKey("raw",t.publicKey)),r=vt(n);h.textContent="Funding test account...",await Q(e,"surfnet_setAccount",[r,{lamports:1e9,data:"",executable:!1,owner:"11111111111111111111111111111111",rentEpoch:0}]);let o=Ue(I.currency,y),a=o===null,i=f.tokenProgram??bt(I.currency,y);a||(await Q(e,"surfnet_setTokenAccount",[r,o,{amount:Number(BigInt(I.amount)),state:"initialized"},i]),await Q(e,"surfnet_setTokenAccount",[I.recipient,o,{amount:0,state:"initialized"},i])),h.textContent="Building transaction...";let u=f.recentBlockhash??(await Q(e,"getLatestBlockhash",[{commitment:"confirmed"}])).value.blockhash,c=_(u),A=BigInt(I.amount),O=f.splits??[],l=0n;for(let D of O)l+=BigInt(D.amount);let M=A-l,L=_(I.recipient),b=f.feePayer===!0&&!!f.feePayerKey,P=b?_(f.feePayerKey):n,F=b?P:n,N=wt();if(a){N.push(ue(n,L,M)),z(N,I.externalId);for(let D of O)N.push(ue(n,_(D.recipient),BigInt(D.amount))),z(N,D.memo)}else{let D=_(o),$=f.decimals??6,X=_(await H(r,o,i)),de=_(await H(I.recipient,o,i));N.push(_e(X,D,de,n,M,$,i)),z(N,I.externalId);for(let W of O){let Ae=_(W.recipient),te=_(await H(W.recipient,o,i));Mt(b,W)&&N.push(yt(F,te,Ae,D,i)),N.push(_e(X,D,te,n,BigInt(W.amount),$,i)),z(N,W.memo)}}h.textContent="Signing transaction...";let R=Ut(N,P,n,c),G=new Uint8Array(await crypto.subtle.sign("Ed25519",t.privateKey,R)),x=b?2:1,p=new Uint8Array(1+x*64+R.length);p[0]=x,b?p.set(G,65):p.set(G,1),p.set(R,1+x*64),h.textContent="Submitting payment...";let s=btoa(String.fromCharCode(...p)),g=Ct,E={challenge:{id:d.id,intent:d.intent,method:d.method,realm:d.realm,request:g,...d.expires&&{expires:d.expires},...d.description&&{description:d.description}},payload:{transaction:s,type:"transaction"}},B=Me(JSON.stringify(E));await pt(\`Payment \${B}\`)}async function pt(e){let t=new URL(window.location.href),n=we?"__mppx_worker":"__mpp_worker";t.searchParams.set(n,"1");let r=await navigator.serviceWorker.register(t.toString(),{scope:"/"}),o=r.installing??r.waiting??r.active;if(!o)throw new Error("Service worker not available");await new Promise(i=>{if(o.state==="activated")return i();o.addEventListener("statechange",()=>{o.state==="activated"&&i()})});let a=r.active;if(!a)throw new Error("Service worker not active");await new Promise((i,u)=>{let c=new MessageChannel;c.port1.onmessage=A=>{A.data==="ack"||A.data?.received?i():u(new Error("SW nack"))},a.postMessage({credential:e},[c.port2])}),window.location.reload()}var Dt="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";function _(e){let t=[];for(let n of e){let r=Dt.indexOf(n);if(r<0)throw new Error("bad b58");for(let o=0;o<t.length;o++)r+=t[o]*58,t[o]=r&255,r>>=8;for(;r>0;)t.push(r&255),r>>=8}for(let n of e){if(n!=="1")break;t.push(0)}return new Uint8Array(t.reverse())}function vt(e){let t=[0];for(let r of e){let o=r;for(let a=0;a<t.length;a++)o+=t[a]<<8,t[a]=o%58,o=o/58|0;for(;o>0;)t.push(o%58),o=o/58|0}let n="";for(let r of e){if(r!==0)break;n+="1"}for(let r=t.length-1;r>=0;r--)n+=Dt[t[r]];return n}function Me(e){return btoa(String.fromCharCode(...new TextEncoder().encode(e))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}async function Q(e,t,n){let o=await(await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:t,params:n})})).json();if(o.error)throw new Error(\`\${t}: \${o.error.message}\`);return o.result}function Lt(e){return ee.rpcUrl?ee.rpcUrl:e==="devnet"?"https://api.devnet.solana.com":e==="localnet"?"http://localhost:8899":"https://api.mainnet-beta.solana.com"}var ni="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",ri="TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",be={USDC:{devnet:"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","mainnet-beta":"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},USDT:{"mainnet-beta":"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"},USDG:{devnet:"4F6PM96JJxngmHnZLBh9n58RH4aTVNWvDs2nuwrT5BP7","mainnet-beta":"2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH"},PYUSD:{devnet:"CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM","mainnet-beta":"2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"},CASH:{"mainnet-beta":"CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH"}},oi=new Set(["PYUSD","USDG","CASH"]);function Ue(e,t){if(e.toLowerCase()==="sol")return null;if(e.length>=32)return e;let n=be[e.toUpperCase()];return n?.[t]??n?.["mainnet-beta"]??e}function ai(e,t){let n=e.toUpperCase();if(be[n])return n;let r=Ue(e,t);if(r){for(let[o,a]of Object.entries(be))if(Object.values(a).includes(r))return o}}function bt(e,t){let n=ai(e,t);return n&&oi.has(n)?ri:ni}async function H(e,t,n){let[r]=await Nt({owner:J(e),mint:J(t),tokenProgram:J(n)});return r}var ft="ComputeBudget111111111111111111111111111111",ii="ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",si="11111111111111111111111111111111",ci="MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";function wt(){let e=new Uint8Array(9);e[0]=3,e[1]=1;let t=new Uint8Array(5);return t[0]=2,new DataView(t.buffer).setUint32(1,2e5,!0),[{programId:ft,accounts:[],data:e},{programId:ft,accounts:[],data:t}]}function yt(e,t,n,r,o){return{programId:ii,data:new Uint8Array([1]),accounts:[{pubkey:e,isSigner:!0,isWritable:!0},{pubkey:t,isSigner:!1,isWritable:!0},{pubkey:n,isSigner:!1,isWritable:!1},{pubkey:r,isSigner:!1,isWritable:!1},{pubkey:_(si),isSigner:!1,isWritable:!1},{pubkey:_(o),isSigner:!1,isWritable:!1}]}}function Mt(e,t){return!e||t.ataCreationRequired===!0}function z(e,t){if(!t)return;let n=new TextEncoder().encode(t);if(n.byteLength>566)throw new Error("memo cannot exceed 566 bytes");e.push({programId:ci,accounts:[],data:n})}function ue(e,t,n){let r=new Uint8Array(12);return new DataView(r.buffer).setUint32(0,2,!0),new DataView(r.buffer).setBigUint64(4,n,!0),{programId:"11111111111111111111111111111111",accounts:[{pubkey:e,isSigner:!0,isWritable:!0},{pubkey:t,isSigner:!1,isWritable:!0}],data:r}}function _e(e,t,n,r,o,a,i){let u=new Uint8Array(10);return u[0]=12,new DataView(u.buffer).setBigUint64(1,o,!0),u[9]=a,{programId:i,accounts:[{pubkey:e,isSigner:!1,isWritable:!0},{pubkey:t,isSigner:!1,isWritable:!1},{pubkey:n,isSigner:!1,isWritable:!0},{pubkey:r,isSigner:!0,isWritable:!1}],data:u}}function U(e){return Array.from(e).map(t=>t.toString(16).padStart(2,"0")).join("")}function se(e){return e<128?new Uint8Array([e]):e<16384?new Uint8Array([e&127|128,e>>7]):new Uint8Array([e&127|128,e>>7&127|128,e>>14])}function Ut(e,t,n,r){let o=new Map,a=U(t);o.set(a,{pubkey:t,isSigner:!0,isWritable:!0});let i=U(n);i!==a&&o.set(i,{pubkey:n,isSigner:!0,isWritable:!0});let u=new Set;for(let s of e){u.add(s.programId);for(let g of s.accounts){let E=U(g.pubkey),B=o.get(E);B?(B.isSigner||=g.isSigner,B.isWritable||=g.isWritable):o.set(E,{...g})}}for(let s of u){let g=_(s),E=U(g);o.has(E)||o.set(E,{pubkey:g,isSigner:!1,isWritable:!1})}let c=[...o.values()],A=c.find(s=>U(s.pubkey)===a),O=c.filter(s=>U(s.pubkey)!==a),l=O.filter(s=>s.isSigner&&s.isWritable),M=O.filter(s=>s.isSigner&&!s.isWritable),L=O.filter(s=>!s.isSigner&&s.isWritable),b=O.filter(s=>!s.isSigner&&!s.isWritable),P=[A,...l,...M,...L,...b],F=new Map;P.forEach((s,g)=>F.set(U(s.pubkey),g));let N=e.map(s=>({pi:F.get(U(_(s.programId))),ai:s.accounts.map(g=>F.get(U(g.pubkey))),d:s.data})),R=[];R.push(new Uint8Array([1+l.length+M.length,M.length,b.length])),R.push(se(P.length));for(let s of P)R.push(s.pubkey);R.push(r),R.push(se(N.length));for(let s of N)R.push(new Uint8Array([s.pi])),R.push(se(s.ai.length)),R.push(new Uint8Array(s.ai)),R.push(se(s.d.length)),R.push(s.d);let G=R.reduce((s,g)=>s+g.length,0),x=new Uint8Array(G),p=0;for(let s of R)x.set(s,p),p+=s.length;return x}})();
</script>`;

// ../mpp/dist/server/keyLock.js
var locks = /* @__PURE__ */ new Map();
function withKeyLock(key, fn) {
  const previous = locks.get(key) ?? Promise.resolve();
  const current = previous.then(() => fn(), () => fn());
  const tail = current.then(() => void 0, () => void 0);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) {
      locks.delete(key);
    }
  });
  return current;
}

// ../mpp/dist/server/network-check.js
var SURFPOOL_BLOCKHASH_PREFIX = "SURFNETxSAFEHASH";
var LOCALNET_NETWORK = "localnet";
var WrongNetworkError = class extends Error {
  blockhash;
  code = "wrong-network";
  expected;
  received = "localnet";
  constructor(opts) {
    super(opts.message);
    this.name = "WrongNetworkError";
    this.expected = opts.expected;
    this.blockhash = opts.blockhash;
  }
};
function checkNetworkBlockhash(network, blockhashB58) {
  if (!blockhashB58.startsWith(SURFPOOL_BLOCKHASH_PREFIX))
    return;
  if (network === LOCALNET_NETWORK)
    return;
  throw new WrongNetworkError({
    blockhash: blockhashB58,
    expected: network,
    message: `Signed against localnet but the server expects ${network}. Switch your client RPC to ${network} and re-sign.`
  });
}

// ../mpp/dist/server/replay.js
var PENDING_LEASE_MS = 21 * 60 * 1e3;
function isReplayRecord(value) {
  if (typeof value !== "object" || value === null)
    return false;
  const record = value;
  return typeof record.binding === "string" && typeof record.leaseUntil === "number" && (record.state === "pending" || record.state === "confirmed");
}
async function inspectReplayKey(store, key, binding) {
  const current = await store.get(key);
  if (current === null)
    return "available";
  if (!isReplayRecord(current) || current.binding !== binding)
    return "conflict";
  if (current.state === "confirmed")
    return "retry";
  return current.leaseUntil <= Date.now() ? "expired" : "pending";
}
async function claimReplayKey(store, key, binding) {
  const now = Date.now();
  const fresh = { binding, leaseUntil: now + PENDING_LEASE_MS, state: "pending" };
  const classify = (current) => {
    if (current === null)
      return "reserved";
    if (!isReplayRecord(current) || current.binding !== binding)
      return "conflict";
    if (current.state === "confirmed")
      return "retry";
    return current.leaseUntil <= now ? "reserved" : "pending";
  };
  const atomicStore = store;
  if (typeof atomicStore.update === "function") {
    return await atomicStore.update(key, (current) => {
      const result = classify(current);
      return result === "reserved" ? { op: "set", result, value: fresh } : { op: "noop", result };
    });
  }
  return await withKeyLock(key, async () => {
    const current = await store.get(key);
    const result = classify(current);
    if (result === "reserved")
      await store.put(key, fresh);
    return result;
  });
}
async function confirmReplayKey(store, key, binding) {
  const current = await store.get(key);
  if (!isReplayRecord(current) || current.binding !== binding) {
    throw new Error("Replay reservation changed before settlement completed");
  }
  await store.put(key, { binding, leaseUntil: current.leaseUntil, state: "confirmed" });
}
async function reserveReplayKey(store, key) {
  const atomicStore = store;
  if (typeof atomicStore.update === "function") {
    return await atomicStore.update(key, (current) => current === null ? { op: "set", result: true, value: true } : { op: "noop", result: false });
  }
  return await withKeyLock(key, async () => {
    if (await store.get(key) !== null)
      return false;
    await store.put(key, true);
    return true;
  });
}

// ../mpp/dist/server/Charge.js
function charge2(parameters) {
  const { recipient, currency, decimals, html: htmlEnabled = false, tokenProgram: configuredTokenProgram, network = "mainnet", store = Store.memory(), splits, signer } = parameters;
  validateNetwork(network);
  const isSplToken = currency !== void 0 && currency !== "sol";
  const tokenProgram = configuredTokenProgram ?? defaultTokenProgramForCurrency(currency, network);
  const rpcUrl = parameters.rpcUrl ?? DEFAULT_RPC_URLS[network] ?? DEFAULT_RPC_URLS["mainnet"];
  if (isSplToken && decimals === void 0) {
    throw new Error("decimals is required when currency is a token mint address");
  }
  if (signer && !isTransactionPartialSigner(signer)) {
    throw new Error("signer must implement signTransactions() for fee payer mode (e.g. KeyPairSigner, SolanaSigner)");
  }
  validateChargeSplits(splits);
  const hasAtaCreationSplits = splits?.some((split) => split.ataCreationRequired === true) === true;
  if (!isSplToken && hasAtaCreationSplits) {
    throw new Error("ataCreationRequired requires an SPL token currency");
  }
  if (hasAtaCreationSplits && (currency === void 0 || resolveStablecoinMint(currency, network) !== currency)) {
    throw new Error("ataCreationRequired requires currency to be an SPL token mint address");
  }
  if (signer && splits?.some((split) => split.recipient === recipient && split.ataCreationRequired === true)) {
    throw new Error("A split that targets the primary recipient must not set ataCreationRequired in fee-sponsored mode");
  }
  const method = Method.toServer(charge, {
    defaults: {
      currency: currency ?? "sol",
      methodDetails: {},
      recipient: ""
    },
    html: htmlEnabled ? {
      config: {},
      content: PAYMENT_UI_JS,
      formatAmount: (request) => {
        const dec = decimals ?? (request.currency.toLowerCase() === "sol" ? 9 : 6);
        const raw = Number(request.amount) / 10 ** dec;
        const display = raw % 1 === 0 ? raw.toString() : raw.toFixed(Math.min(dec, 2));
        if (request.currency.toLowerCase() === "sol")
          return `${display} SOL`;
        const sym = stablecoinSymbolForCurrency(request.currency);
        if (sym)
          return `$${display}`;
        return `${display} ${request.currency.slice(0, 6)}`;
      },
      text: void 0,
      theme: {
        logo: {
          dark: "https://solana.com/src/img/branding/solanaLogoMark.svg",
          light: "https://solana.com/src/img/branding/solanaLogoMark.svg"
        }
      }
    } : void 0,
    async request({ credential, request }) {
      let recentBlockhash;
      if (!credential) {
        try {
          const res = await fetch(rpcUrl, {
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "getLatestBlockhash",
              params: [{ commitment: "confirmed" }]
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          });
          const data = await res.json();
          recentBlockhash = data.result?.value?.blockhash;
        } catch {
        }
      }
      return {
        ...request,
        methodDetails: {
          network,
          ...isSplToken ? { decimals, tokenProgram } : {},
          ...signer ? { feePayer: true, feePayerKey: signer.address } : {},
          ...splits?.length ? { splits } : {},
          ...recentBlockhash ? { recentBlockhash } : {}
        },
        recipient
      };
    },
    async verify({ credential }) {
      const cred = credential;
      const challenge = cred.challenge.request;
      const payloadType = resolvePayloadType(cred.payload);
      if (payloadType === "signature" && challenge.methodDetails.feePayer) {
        throw new Error('type="signature" credentials cannot be used with fee sponsorship (feePayer: true)');
      }
      if (payloadType === "transaction") {
        return await verifyTransaction(cred, challenge, rpcUrl, recipient, store, signer, network);
      }
      return await verifySignature(cred, challenge, rpcUrl, recipient, store);
    }
  });
  return method;
}
var MAX_SPLITS = 8;
function validateChargeSplits(splits) {
  if (!splits || splits.length === 0)
    return;
  if (splits.length > MAX_SPLITS) {
    throw new Error(`splits cannot exceed ${MAX_SPLITS} entries`);
  }
  const U64_MAX = (1n << 64n) - 1n;
  let total = 0n;
  for (const split of splits) {
    try {
      address(split.recipient);
    } catch {
      throw new Error(`Invalid split recipient: ${split.recipient}`);
    }
    let amount;
    try {
      amount = BigInt(split.amount);
    } catch {
      throw new Error(`Invalid split amount: ${split.amount}`);
    }
    if (amount <= 0n) {
      throw new Error(`Split amount must be positive: ${split.amount}`);
    }
    total += amount;
    if (total > U64_MAX) {
      throw new Error("Split amounts overflow u64");
    }
  }
}
function resolvePayloadType(payload) {
  if (payload.type === "signature")
    return "signature";
  if (payload.type === "transaction")
    return "transaction";
  throw new Error('Missing or invalid payload type: must be "transaction" or "signature"');
}
function extractRecentBlockhash(clientTxBase64) {
  try {
    const txBytes = getBase64Codec2().encode(clientTxBase64);
    const decoded = getTransactionDecoder2().decode(txBytes);
    const message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
    assertVersionedTransactionMessage(message);
    return message.lifetimeToken;
  } catch {
    return null;
  }
}
var MAX_COMPUTE_UNIT_LIMIT = 2e5;
var MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS2 = 5000000n;
var MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS_FEE_SPONSORED = 10000n;
async function verifyChargeTransaction(clientTxBase64, challenge) {
  let message;
  try {
    const txBytes = getBase64Codec2().encode(clientTxBase64);
    const decoded = getTransactionDecoder2().decode(txBytes);
    message = getCompiledTransactionMessageDecoder().decode(decoded.messageBytes);
  } catch (e) {
    throw new Error(`Invalid transaction: ${e instanceof Error ? e.message : String(e)}`);
  }
  assertVersionedTransactionMessage(message);
  if (message.addressTableLookups?.length) {
    throw new Error("v0 transactions with address lookup tables are not supported");
  }
  const splits = challenge.methodDetails.splits ?? [];
  if (splits.length > 8) {
    throw new Error(`Too many splits: ${splits.length} (maximum 8)`);
  }
  const totalAmount2 = BigInt(challenge.amount);
  const splitsTotal = splits.reduce((sum, split) => sum + BigInt(split.amount), 0n);
  const primaryAmount = totalAmount2 - splitsTotal;
  if (primaryAmount <= 0n) {
    throw new Error("Splits consume the entire amount \u2014 primary recipient must receive a positive amount");
  }
  const feePayer = expectedFeePayer(message, challenge.methodDetails);
  const isNativeSol = challenge.currency.toLowerCase() === "sol";
  if (isNativeSol && splits.some((split) => split.ataCreationRequired === true)) {
    throw new Error("ataCreationRequired requires an SPL token charge");
  }
  const matchedInstructionIndexes = /* @__PURE__ */ new Set();
  const ataPolicy = expectedAtaCreationPolicy(challenge, feePayer);
  if (isNativeSol) {
    verifySolTransferPreBroadcast(message, challenge.recipient, primaryAmount, feePayer, matchedInstructionIndexes);
    for (const split of splits) {
      verifySolTransferPreBroadcast(message, split.recipient, BigInt(split.amount), feePayer, matchedInstructionIndexes);
    }
    verifyMemoInstructionsPreBroadcast(message, challenge.externalId, splits, matchedInstructionIndexes);
    await validateInstructionAllowlist(message, matchedInstructionIndexes, {
      allowedAtaOwners: ataPolicy.allowedAtaOwners,
      expectedMint: void 0,
      expectedTokenProgram: void 0,
      feePayer,
      requiredAtaOwners: ataPolicy.requiredAtaOwners
    });
    return;
  }
  const expectedMint = resolveStablecoinMint(challenge.currency, challenge.methodDetails.network);
  if (!expectedMint) {
    throw new Error("SPL charge is missing a mint address");
  }
  if (ataPolicy.requiredAtaOwners.size > 0 && challenge.currency !== expectedMint) {
    throw new Error("ataCreationRequired requires currency to be an SPL token mint address");
  }
  const expectedTokenProgram = challenge.methodDetails.tokenProgram ?? defaultTokenProgramForCurrency(challenge.currency, challenge.methodDetails.network);
  await verifySplTransferPreBroadcast(message, challenge.recipient, expectedMint, primaryAmount, expectedTokenProgram, challenge.methodDetails.decimals, feePayer, matchedInstructionIndexes);
  for (const split of splits) {
    await verifySplTransferPreBroadcast(message, split.recipient, expectedMint, BigInt(split.amount), expectedTokenProgram, challenge.methodDetails.decimals, feePayer, matchedInstructionIndexes);
  }
  verifyMemoInstructionsPreBroadcast(message, challenge.externalId, splits, matchedInstructionIndexes);
  await validateInstructionAllowlist(message, matchedInstructionIndexes, {
    allowedAtaOwners: ataPolicy.allowedAtaOwners,
    expectedMint,
    expectedTokenProgram,
    feePayer,
    requiredAtaOwners: ataPolicy.requiredAtaOwners
  });
}
function expectedFeePayer(message, methodDetails) {
  if (!methodDetails.feePayer) {
    return void 0;
  }
  const feePayerKey = methodDetails.feePayerKey;
  if (!feePayerKey) {
    throw new Error("feePayer=true requires feePayerKey in methodDetails");
  }
  const txFeePayer = message.staticAccounts[0];
  if (txFeePayer !== feePayerKey) {
    throw new Error(`Transaction fee payer must be ${feePayerKey}`);
  }
  return feePayerKey;
}
function expectedAtaCreationPolicy(challenge, feePayer) {
  const splits = challenge.methodDetails.splits ?? [];
  const requiredAtaOwners = new Set(splits.filter((split) => split.ataCreationRequired === true).map((split) => split.recipient));
  if (feePayer) {
    return { allowedAtaOwners: new Set(requiredAtaOwners), requiredAtaOwners };
  }
  return {
    allowedAtaOwners: new Set(splits.map((split) => split.recipient)),
    requiredAtaOwners
  };
}
function verifySolTransferPreBroadcast(message, recipient, amount, feePayer, matchedInstructionIndexes) {
  for (const [index, ix] of message.instructions.entries()) {
    if (matchedInstructionIndexes.has(index))
      continue;
    if (programAddress(message, ix) !== SYSTEM_PROGRAM)
      continue;
    if (ix.data.length < 12 || readU32Le(ix.data, 0) !== 2)
      continue;
    if (readU64Le(ix.data, 4) !== amount)
      continue;
    if (ix.accountIndices.length < 2)
      continue;
    const source = accountAddress(message, ix.accountIndices[0], "source");
    const destination = accountAddress(message, ix.accountIndices[1], "destination");
    if (destination !== recipient)
      continue;
    if (feePayer && source === feePayer) {
      throw new Error("Fee payer cannot fund the SOL payment transfer");
    }
    matchedInstructionIndexes.add(index);
    return;
  }
  throw new Error(`No matching SOL transfer of ${amount} lamports to ${recipient}`);
}
async function verifySplTransferPreBroadcast(message, recipient, expectedMint, amount, expectedTokenProgram, expectedDecimals, feePayer, matchedInstructionIndexes) {
  for (const [index, ix] of message.instructions.entries()) {
    if (matchedInstructionIndexes.has(index))
      continue;
    const program = programAddress(message, ix);
    if (program !== TOKEN_PROGRAM && program !== TOKEN_2022_PROGRAM)
      continue;
    if (program !== expectedTokenProgram)
      continue;
    if (ix.data.length < 10 || ix.data[0] !== 12)
      continue;
    if (readU64Le(ix.data, 1) !== amount)
      continue;
    if (expectedDecimals !== void 0 && ix.data[9] !== expectedDecimals)
      continue;
    if (ix.accountIndices.length < 4)
      continue;
    const sourceAta = accountAddress(message, ix.accountIndices[0], "source ATA");
    const mint = accountAddress(message, ix.accountIndices[1], "mint");
    const destinationAta = accountAddress(message, ix.accountIndices[2], "destination ATA");
    const authority = accountAddress(message, ix.accountIndices[3], "authority");
    if (mint !== expectedMint)
      continue;
    if (feePayer) {
      if (authority === feePayer) {
        throw new Error("Fee payer cannot authorize the SPL payment transfer");
      }
      const [feePayerAta] = await findAssociatedTokenPda({
        mint: address(expectedMint),
        owner: address(feePayer),
        tokenProgram: address(program)
      });
      if (sourceAta === feePayerAta) {
        throw new Error("Fee payer token account cannot fund the SPL payment transfer");
      }
    }
    const [expectedAta] = await findAssociatedTokenPda({
      mint: address(expectedMint),
      owner: address(recipient),
      tokenProgram: address(program)
    });
    if (destinationAta !== expectedAta)
      continue;
    matchedInstructionIndexes.add(index);
    return;
  }
  throw new Error(`No matching SPL transferChecked of ${amount} to ${recipient}`);
}
async function validateInstructionAllowlist(message, matchedPaymentInstructionIndexes, options) {
  const txFeePayer = message.staticAccounts[0];
  if (!txFeePayer) {
    throw new Error("Transaction has no fee payer");
  }
  const expectedAtaPayer = options.feePayer ?? txFeePayer;
  const createdAtaOwners = /* @__PURE__ */ new Set();
  for (const [index, ix] of message.instructions.entries()) {
    const program = programAddress(message, ix);
    if (program === COMPUTE_BUDGET_PROGRAM) {
      validateComputeBudgetInstruction(ix, options.feePayer !== void 0);
      continue;
    }
    if (program === MEMO_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected Memo Program instruction in payment transaction");
    }
    if (program === SYSTEM_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected System Program instruction in payment transaction");
    }
    if (program === TOKEN_PROGRAM || program === TOKEN_2022_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected Token Program instruction in payment transaction");
    }
    if (program === ASSOCIATED_TOKEN_PROGRAM) {
      const owner = await validateCreateAtaIdempotentInstruction(message, ix, options.expectedMint, options.allowedAtaOwners, options.expectedTokenProgram, expectedAtaPayer);
      createdAtaOwners.add(owner);
      continue;
    }
    throw new Error(`Unexpected program instruction in payment transaction: ${program}`);
  }
  for (const owner of options.requiredAtaOwners) {
    if (!createdAtaOwners.has(owner)) {
      throw new Error(`Missing required ATA creation instruction for split recipient ${owner}`);
    }
  }
}
function validateComputeBudgetInstruction(ix, feeSponsored) {
  if ((ix.accountIndices ?? []).length !== 0) {
    throw new Error("Compute budget instruction must not have accounts");
  }
  if (ix.data[0] === 2 && ix.data.length === 5) {
    const units = readU32Le(ix.data, 1);
    if (units > MAX_COMPUTE_UNIT_LIMIT) {
      throw new Error(`Compute unit limit ${units} exceeds maximum ${MAX_COMPUTE_UNIT_LIMIT}`);
    }
    return;
  }
  if (ix.data[0] === 3 && ix.data.length === 9) {
    const price = readU64Le(ix.data, 1);
    const cap = feeSponsored ? MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS_FEE_SPONSORED : MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS2;
    if (price > cap) {
      throw new Error(`Compute unit price ${price} exceeds maximum ${cap}`);
    }
    return;
  }
  throw new Error("Unsupported compute budget instruction");
}
async function validateCreateAtaIdempotentInstruction(message, ix, expectedMint, allowedAtaOwners, expectedTokenProgram, expectedPayer) {
  if (!expectedMint) {
    throw new Error("ATA creation is not allowed for native SOL payments");
  }
  if (ix.data.length !== 1 || ix.data[0] !== 1) {
    throw new Error("Only idempotent ATA creation is allowed");
  }
  if (ix.accountIndices.length !== 6) {
    throw new Error("Unexpected ATA creation account layout");
  }
  const payer = accountAddress(message, ix.accountIndices[0], "ATA payer");
  const ata = accountAddress(message, ix.accountIndices[1], "ATA address");
  const owner = accountAddress(message, ix.accountIndices[2], "ATA owner");
  const mint = accountAddress(message, ix.accountIndices[3], "ATA mint");
  const systemProgram = accountAddress(message, ix.accountIndices[4], "ATA system program");
  const tokenProgram = accountAddress(message, ix.accountIndices[5], "ATA token program");
  if (payer !== expectedPayer) {
    throw new Error("ATA payer must match the transaction fee payer");
  }
  if (mint !== expectedMint) {
    throw new Error("ATA creation mint does not match the charge currency");
  }
  if (systemProgram !== SYSTEM_PROGRAM) {
    throw new Error("ATA creation must reference the System Program");
  }
  if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) {
    throw new Error("ATA creation uses an unsupported token program");
  }
  if (expectedTokenProgram && tokenProgram !== expectedTokenProgram) {
    throw new Error("ATA creation token program does not match methodDetails.tokenProgram");
  }
  const [expectedAta] = await findAssociatedTokenPda({
    mint: address(mint),
    owner: address(owner),
    tokenProgram: address(tokenProgram)
  });
  if (ata !== expectedAta) {
    throw new Error("ATA creation address does not match owner/mint/token program");
  }
  if (!allowedAtaOwners.has(owner)) {
    throw new Error("ATA creation owner is not authorized by the challenge");
  }
  return owner;
}
function programAddress(message, ix) {
  return accountAddress(message, ix.programAddressIndex, "program address");
}
function accountAddress(message, index, label) {
  const value = message.staticAccounts[index];
  if (!value) {
    throw new Error(`Invalid ${label} index`);
  }
  return value;
}
function readU32Le(data, offset) {
  return (data[offset] | data[offset + 1] << 8 | data[offset + 2] << 16 | data[offset + 3] << 24) >>> 0;
}
function readU64Le(data, offset) {
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value |= BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return value;
}
async function verifyTransaction(credential, challenge, rpcUrl, recipient, store, signer, network) {
  const { transaction: clientTxBase64 } = credential.payload;
  if (!clientTxBase64) {
    throw new Error("Missing transaction data in credential payload");
  }
  const recentBlockhash = extractRecentBlockhash(clientTxBase64);
  if (recentBlockhash !== null) {
    checkNetworkBlockhash(network, recentBlockhash);
  }
  await verifyChargeTransaction(clientTxBase64, challenge);
  let txToSend = clientTxBase64;
  if (signer) {
    txToSend = await coSignBase64Transaction(signer, clientTxBase64);
  }
  const signature = transactionSignatureFromBase64(txToSend);
  const replayKey = `solana-charge:consumed:${signature}`;
  const replayBinding = JSON.stringify({ challengeId: credential.challenge.id ?? null, request: challenge });
  const replayStatus = await inspectReplayKey(store, replayKey, replayBinding);
  if (replayStatus === "conflict") {
    throw new Error("Transaction signature already consumed");
  }
  if (replayStatus === "pending")
    throw new Error("Transaction settlement is already in progress; retry shortly");
  let needsConfirmation = replayStatus !== "retry";
  if (replayStatus === "expired") {
    const recoveryClaim = await claimReplayKey(store, replayKey, replayBinding);
    if (recoveryClaim === "conflict")
      throw new Error("Transaction signature already consumed");
    if (recoveryClaim === "pending") {
      throw new Error("Transaction settlement is already in progress; retry shortly");
    }
    needsConfirmation = recoveryClaim !== "retry";
  } else if (replayStatus === "available") {
    await simulateTransaction(rpcUrl, txToSend);
    await broadcastTransaction(rpcUrl, txToSend);
    const replayClaim = await claimReplayKey(store, replayKey, replayBinding);
    if (replayClaim === "conflict")
      throw new Error("Transaction signature already consumed");
    if (replayClaim === "pending") {
      throw new Error("Transaction settlement is already in progress; retry shortly");
    }
    needsConfirmation = replayClaim !== "retry";
  }
  if (needsConfirmation) {
    await waitForConfirmation(rpcUrl, signature);
  }
  await verifyOnChain(rpcUrl, signature, challenge, recipient);
  await confirmReplayKey(store, replayKey, replayBinding);
  return Receipt.from({
    method: "solana",
    ...credential.challenge.id ? { challengeId: credential.challenge.id } : {},
    reference: signature,
    ...challenge.externalId ? { externalId: challenge.externalId } : {},
    status: "success",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
async function verifySignature(credential, challenge, rpcUrl, recipient, store) {
  const { signature } = credential.payload;
  if (!signature) {
    throw new Error("Missing signature in credential payload");
  }
  const consumedKey = `solana-charge:consumed:${signature}`;
  if (await store.get(consumedKey)) {
    throw new Error("Transaction signature already consumed");
  }
  return await withKeyLock(consumedKey, async () => {
    if (await store.get(consumedKey)) {
      throw new Error("Transaction signature already consumed");
    }
    const tx = await fetchTransaction(rpcUrl, signature);
    if (!tx)
      throw new Error("Transaction not found or not yet confirmed");
    assertReportedTransactionVersion(tx.version);
    if (tx.meta?.err)
      throw new Error("Transaction failed on-chain");
    const instructions = tx.transaction.message.instructions;
    await verifyInstructions(instructions, challenge, recipient);
    await store.put(consumedKey, true);
    return Receipt.from({
      method: "solana",
      ...credential.challenge.id ? { challengeId: credential.challenge.id } : {},
      reference: signature,
      ...challenge.externalId ? { externalId: challenge.externalId } : {},
      status: "success",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
}
async function verifyOnChain(rpcUrl, signature, challenge, recipient) {
  const tx = await fetchTransaction(rpcUrl, signature);
  if (!tx)
    throw new Error("Transaction not found or not yet confirmed");
  assertReportedTransactionVersion(tx.version);
  if (tx.meta?.err)
    throw new Error("Transaction failed on-chain");
  const instructions = tx.transaction.message.instructions;
  await verifyInstructions(instructions, challenge, recipient);
}
async function verifyInstructions(instructions, challenge, recipient) {
  const splits = challenge.methodDetails.splits ?? [];
  const splitsTotal = splits.reduce((sum, s) => sum + BigInt(s.amount), 0n);
  const primaryAmount = BigInt(challenge.amount) - splitsTotal;
  if (primaryAmount <= 0n) {
    throw new Error("Splits consume the entire amount \u2014 primary recipient must receive a positive amount");
  }
  const mint = resolveStablecoinMint(challenge.currency, challenge.methodDetails.network);
  const matchedInstructionIndexes = /* @__PURE__ */ new Set();
  const feePayer = challenge.methodDetails.feePayer === true ? challenge.methodDetails.feePayerKey : void 0;
  if (challenge.methodDetails.feePayer === true && !feePayer) {
    throw new Error("feePayer=true requires feePayerKey in methodDetails");
  }
  const ataPolicy = expectedAtaCreationPolicy(challenge, feePayer);
  if (mint) {
    if (splits.some((split) => split.ataCreationRequired === true) && challenge.currency !== mint) {
      throw new Error("ataCreationRequired requires currency to be an SPL token mint address");
    }
    const expectedTokenProgram = challenge.methodDetails.tokenProgram ?? defaultTokenProgramForCurrency(challenge.currency, challenge.methodDetails.network);
    await verifySplTransfer(instructions, recipient, String(primaryAmount), mint, expectedTokenProgram, matchedInstructionIndexes);
    for (const split of splits) {
      await verifySplTransfer(instructions, split.recipient, split.amount, mint, expectedTokenProgram, matchedInstructionIndexes);
    }
    verifyMemoInstructions(instructions, challenge.externalId, splits, matchedInstructionIndexes);
    await validateParsedInstructionAllowlist(instructions, matchedInstructionIndexes, {
      allowedAtaOwners: ataPolicy.allowedAtaOwners,
      expectedAtaPayer: feePayer,
      expectedMint: mint,
      expectedTokenProgram,
      requiredAtaOwners: ataPolicy.requiredAtaOwners
    });
  } else {
    if (splits.some((split) => split.ataCreationRequired === true)) {
      throw new Error("ataCreationRequired requires an SPL token charge");
    }
    verifySolTransfer(instructions, recipient, String(primaryAmount), matchedInstructionIndexes);
    for (const split of splits) {
      verifySolTransfer(instructions, split.recipient, split.amount, matchedInstructionIndexes);
    }
    verifyMemoInstructions(instructions, challenge.externalId, splits, matchedInstructionIndexes);
    await validateParsedInstructionAllowlist(instructions, matchedInstructionIndexes, {
      allowedAtaOwners: ataPolicy.allowedAtaOwners,
      expectedAtaPayer: void 0,
      expectedMint: void 0,
      expectedTokenProgram: void 0,
      requiredAtaOwners: ataPolicy.requiredAtaOwners
    });
  }
}
async function verifySplTransfer(instructions, recipientAddress, expectedAmount, spl, tokenProgram, matchedInstructionIndexes) {
  const [expectedAta] = await findAssociatedTokenPda({
    mint: address(spl),
    owner: address(recipientAddress),
    tokenProgram: address(tokenProgram)
  });
  for (const [index, ix] of instructions.entries()) {
    if (matchedInstructionIndexes.has(index))
      continue;
    if (typeof ix.parsed !== "object" || ix.parsed?.type !== "transferChecked")
      continue;
    if (ix.programId !== tokenProgram)
      continue;
    const info = ix.parsed.info;
    if (info.destination === expectedAta && info.mint === spl && info.tokenAmount?.amount === expectedAmount) {
      matchedInstructionIndexes.add(index);
      return;
    }
  }
  throw new Error(`No TransferChecked instruction found for recipient ${recipientAddress}`);
}
function verifySolTransfer(instructions, recipientAddress, expectedAmount, matchedInstructionIndexes) {
  for (const [index, ix] of instructions.entries()) {
    if (matchedInstructionIndexes.has(index))
      continue;
    if (typeof ix.parsed !== "object" || ix.parsed?.type !== "transfer" || ix.program !== "system")
      continue;
    const info = ix.parsed.info;
    if (info.destination === recipientAddress && String(info.lamports) === expectedAmount) {
      matchedInstructionIndexes.add(index);
      return;
    }
  }
  throw new Error(`No system transfer instruction found for recipient ${recipientAddress}`);
}
function verifyMemoInstructionsPreBroadcast(message, externalId, splits, matchedInstructionIndexes) {
  for (const expectedMemo of expectedMemoEntries(externalId, splits)) {
    const expectedData = new TextEncoder().encode(expectedMemo.value);
    if (expectedData.byteLength > 566) {
      throw new Error("memo cannot exceed 566 bytes");
    }
    let found = false;
    for (const [index, ix] of message.instructions.entries()) {
      if (matchedInstructionIndexes.has(index))
        continue;
      if (programAddress(message, ix) !== MEMO_PROGRAM)
        continue;
      if (bytesEqual(ix.data, expectedData)) {
        matchedInstructionIndexes.add(index);
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`No memo instruction found for ${expectedMemo.label} memo "${expectedMemo.value}"`);
    }
  }
}
function verifyMemoInstructions(instructions, externalId, splits, matchedInstructionIndexes) {
  for (const expectedMemo of expectedMemoEntries(externalId, splits)) {
    if (new TextEncoder().encode(expectedMemo.value).byteLength > 566) {
      throw new Error("memo cannot exceed 566 bytes");
    }
    let found = false;
    for (const [index, ix] of instructions.entries()) {
      if (matchedInstructionIndexes.has(index))
        continue;
      if (parsedProgramId(ix) !== MEMO_PROGRAM)
        continue;
      if (parsedMemoText(ix) === expectedMemo.value) {
        matchedInstructionIndexes.add(index);
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`No memo instruction found for ${expectedMemo.label} memo "${expectedMemo.value}"`);
    }
  }
}
function expectedMemoEntries(externalId, splits) {
  const entries = [];
  if (externalId) {
    entries.push({ label: "externalId", value: externalId });
  }
  for (const split of splits) {
    if (split.memo) {
      entries.push({ label: "split", value: split.memo });
    }
  }
  return entries;
}
function parsedMemoText(ix) {
  if (typeof ix.parsed === "string")
    return ix.parsed;
  if (typeof ix.parsed?.info?.memo === "string")
    return ix.parsed.info.memo;
  if (typeof ix.parsed?.info?.data === "string")
    return ix.parsed.info.data;
}
function bytesEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}
async function validateParsedInstructionAllowlist(instructions, matchedPaymentInstructionIndexes, options) {
  const createdAtaOwners = /* @__PURE__ */ new Set();
  for (const [index, ix] of instructions.entries()) {
    const programId = parsedProgramId(ix);
    if (programId === COMPUTE_BUDGET_PROGRAM) {
      continue;
    }
    if (programId === MEMO_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected Memo Program instruction in payment transaction");
    }
    if (programId === SYSTEM_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected System Program instruction in payment transaction");
    }
    if (programId === TOKEN_PROGRAM || programId === TOKEN_2022_PROGRAM) {
      if (matchedPaymentInstructionIndexes.has(index))
        continue;
      throw new Error("Unexpected Token Program instruction in payment transaction");
    }
    if (programId === ASSOCIATED_TOKEN_PROGRAM) {
      const owner = await validateParsedAtaCreationInstruction(ix, options);
      createdAtaOwners.add(owner);
      continue;
    }
    throw new Error(`Unexpected program instruction in payment transaction: ${programId ?? "unknown"}`);
  }
  for (const owner of options.requiredAtaOwners) {
    if (!createdAtaOwners.has(owner)) {
      throw new Error(`Missing required ATA creation instruction for split recipient ${owner}`);
    }
  }
}
function parsedProgramId(ix) {
  if (ix.programId)
    return ix.programId;
  if (ix.program === "system")
    return SYSTEM_PROGRAM;
  if (ix.program === "compute-budget")
    return COMPUTE_BUDGET_PROGRAM;
  if (ix.program === "spl-memo")
    return MEMO_PROGRAM;
  if (ix.program === "spl-associated-token-account")
    return ASSOCIATED_TOKEN_PROGRAM;
  return void 0;
}
async function validateParsedAtaCreationInstruction(ix, options) {
  if (!options.expectedMint) {
    throw new Error("ATA creation is not allowed for native SOL payments");
  }
  if (typeof ix.parsed !== "object" || ix.parsed?.type !== "createIdempotent") {
    throw new Error("Only idempotent ATA creation is allowed");
  }
  const info = ix.parsed.info;
  const payer = stringField(info, "source", "payer");
  const ata = stringField(info, "account", "associatedAccount", "associatedTokenAddress");
  const owner = stringField(info, "wallet", "owner");
  const mint = stringField(info, "mint");
  const tokenProgram = stringField(info, "tokenProgram") ?? options.expectedTokenProgram;
  if (!payer || !ata || !owner || !mint || !tokenProgram) {
    throw new Error("ATA creation parsed instruction is missing required fields");
  }
  if (options.expectedAtaPayer && payer !== options.expectedAtaPayer) {
    throw new Error("ATA payer must match the transaction fee payer");
  }
  if (mint !== options.expectedMint) {
    throw new Error("ATA creation mint does not match the charge currency");
  }
  if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) {
    throw new Error("ATA creation uses an unsupported token program");
  }
  if (options.expectedTokenProgram && tokenProgram !== options.expectedTokenProgram) {
    throw new Error("ATA creation token program does not match methodDetails.tokenProgram");
  }
  const [expectedAta] = await findAssociatedTokenPda({
    mint: address(mint),
    owner: address(owner),
    tokenProgram: address(tokenProgram)
  });
  if (ata !== expectedAta) {
    throw new Error("ATA creation address does not match owner/mint/token program");
  }
  if (!options.allowedAtaOwners.has(owner)) {
    throw new Error("ATA creation owner is not authorized by the challenge");
  }
  return owner;
}
function stringField(info, ...keys) {
  for (const key of keys) {
    const value = info[key];
    if (typeof value === "string")
      return value;
  }
  return void 0;
}
async function fetchTransaction(rpcUrl, signature) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "getTransaction",
      params: [
        signature,
        {
          commitment: "confirmed",
          encoding: "jsonParsed",
          maxSupportedTransactionVersion: 1
        }
      ]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  return data.result ?? null;
}
async function simulateTransaction(rpcUrl, base64Tx) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "simulateTransaction",
      params: [base64Tx, { commitment: "confirmed", encoding: "base64" }]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  const simErr = data.result?.value?.err;
  if (simErr) {
    const logs = data.result?.value?.logs ?? [];
    console.error("[solana-mpp] Simulation failed:", JSON.stringify(simErr));
    for (const log of logs)
      console.error("[solana-mpp]", log);
    throw new Error(`Transaction simulation failed: ${JSON.stringify(simErr)}`);
  }
}
async function broadcastTransaction(rpcUrl, base64Tx) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "sendTransaction",
      params: [base64Tx, { encoding: "base64", skipPreflight: false }]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  if (!data.result)
    throw new Error("No signature returned from sendTransaction");
  return data.result;
}
function interpretPostTimeoutStatus(status, rpcError) {
  if (rpcError !== void 0) {
    return { detail: rpcError, kind: "timeout" };
  }
  if (status === null) {
    return { kind: "timeout" };
  }
  if (status.err) {
    return { detail: JSON.stringify(status.err), kind: "failed" };
  }
  return { kind: "confirmed" };
}
async function waitForConfirmation(rpcUrl, signature, timeoutMs = 3e4) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(rpcUrl, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "getSignatureStatuses",
        params: [[signature]]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const data = await response.json();
    const status = data.result?.value?.[0];
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
  const outcome = await fetchPostTimeoutStatus(rpcUrl, signature);
  switch (outcome.kind) {
    case "confirmed":
      console.warn(`[solana-mpp] confirmed_via_status_recovery: ${signature}`);
      return;
    case "failed":
      throw new Error(`Transaction landed on-chain but failed: ${outcome.detail}`);
    case "timeout":
      throw new Error(outcome.detail ? `Transaction confirmation timeout (status recovery failed: ${outcome.detail})` : "Transaction confirmation timeout");
  }
}
async function fetchPostTimeoutStatus(rpcUrl, signature) {
  try {
    const response = await fetch(rpcUrl, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "getSignatureStatuses",
        params: [[signature], { searchTransactionHistory: true }]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const data = await response.json();
    if (data.error) {
      return interpretPostTimeoutStatus(null, data.error.message);
    }
    return interpretPostTimeoutStatus(data.result?.value?.[0] ?? null);
  } catch (e) {
    return interpretPostTimeoutStatus(null, e instanceof Error ? e.message : String(e));
  }
}

// ../mpp/dist/server/Session.js
import { address as address3, createSignableMessage, getBase58Decoder, isTransactionPartialSigner as isTransactionPartialSigner2 } from "@solana/kit";
import { Method as Method2 } from "mppx";

// ../mpp/dist/server/session/lifecycle.js
var MAX_TIMER_DELAY_MS = 2147483647;
function createLifecycle(store, closeOnIdle, idleTimeoutMs) {
  const timers = /* @__PURE__ */ new Map();
  function clear(channelId) {
    const handle = timers.get(channelId);
    if (handle !== void 0) {
      clearTimeout(handle);
      timers.delete(channelId);
    }
  }
  async function closeIfIdle(channelId) {
    timers.delete(channelId);
    let shouldClose = false;
    let nextDeadline;
    await store.updateChannel(channelId, (current) => {
      if (!current)
        throw new Error(`Channel ${channelId} not found`);
      if (current.sealed || current.closeRequestedAt !== void 0)
        return current;
      const timeoutSeconds = current.idleTimeoutSeconds;
      if (!timeoutSeconds || !current.lastActivityAt)
        return current;
      const deadline = current.lastActivityAt + timeoutSeconds * 1e3;
      if (Date.now() < deadline) {
        nextDeadline = deadline;
        return current;
      }
      shouldClose = true;
      return { ...current, closeRequestedAt: BigInt(Math.floor(Date.now() / 1e3)) };
    });
    if (nextDeadline !== void 0) {
      schedule(channelId, nextDeadline);
    } else if (shouldClose) {
      await closeOnIdle(channelId);
    }
  }
  function schedule(channelId, deadlineMs) {
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      void closeIfIdle(channelId).catch(() => void 0);
      return;
    }
    const handle = setTimeout(() => {
      if (Date.now() < deadlineMs)
        schedule(channelId, deadlineMs);
      else
        void closeIfIdle(channelId).catch(() => void 0);
    }, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
    if (typeof handle.unref === "function")
      handle.unref();
    timers.set(channelId, handle);
  }
  function scheduleFromStore(channelId, fallbackSeconds) {
    void store.getChannel(channelId).then((state) => {
      if (!state || state.sealed || state.closeRequestedAt !== void 0)
        return;
      const seconds = state.idleTimeoutSeconds ?? fallbackSeconds;
      if (!seconds || seconds <= 0)
        return;
      schedule(channelId, (state.lastActivityAt ?? Date.now()) + seconds * 1e3);
    }).catch(() => void 0);
  }
  void store.listChannels({ sealed: false }).then((channels) => {
    for (const channel of channels)
      scheduleFromStore(channel.channelId);
  }).catch(() => void 0);
  return {
    removeChannel(channelId) {
      clear(channelId);
    },
    shutdown() {
      for (const handle of timers.values())
        clearTimeout(handle);
      timers.clear();
    },
    touch(channelId, idleTimeoutSeconds) {
      const fallbackSeconds = idleTimeoutSeconds === void 0 ? idleTimeoutMs / 1e3 : idleTimeoutSeconds;
      if (fallbackSeconds <= 0)
        return;
      clear(channelId);
      scheduleFromStore(channelId, fallbackSeconds);
    }
  };
}

// ../mpp/dist/server/session/on-chain.js
import { address as address2, getAddressEncoder, getBase58Encoder, getBase64Codec as getBase64Codec3, getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder2, getI64Encoder, getProgramDerivedAddress, getSignatureFromTransaction as getSignatureFromTransaction2, getTransactionDecoder as getTransactionDecoder3, getU64Encoder, getUtf8Encoder } from "@solana/kit";
import { findAssociatedTokenPda as findAssociatedTokenPda2 } from "@solana-program/token";
var INSTRUCTIONS_SYSVAR_ADDRESS = "Sysvar1nstructions1111111111111111111111111";
var ED25519_PROGRAM_ADDRESS = "Ed25519SigVerify111111111111111111111111111";
var PAYMENT_CHANNELS_PROGRAM_ID2 = PAYMENT_CHANNELS_PROGRAM_ADDRESS;
var OPEN_SLOT_WINDOW2 = 1500n;
var TREASURY_OWNER_BYTES = new Uint8Array([
  176,
  65,
  217,
  211,
  55,
  183,
  33,
  190,
  87,
  137,
  78,
  182,
  156,
  59,
  104,
  9,
  165,
  58,
  14,
  43,
  106,
  35,
  153,
  252,
  125,
  91,
  126,
  218,
  140,
  172,
  137,
  170
]);
var OPEN_DISCRIMINATOR = 1;
var U16_LE = (n) => new Uint8Array([n & 255, n >> 8 & 255]);
function buildEd25519VerifyInstruction(args) {
  if (args.signer.byteLength !== 32)
    throw new Error(`signer must be 32 bytes, got ${args.signer.byteLength}`);
  if (args.signature.byteLength !== 64) {
    throw new Error(`signature must be 64 bytes, got ${args.signature.byteLength}`);
  }
  const publicKeyOffset = 16;
  const signatureOffset = publicKeyOffset + 32;
  const messageDataOffset = signatureOffset + 64;
  const messageDataSize = args.message.byteLength;
  if (messageDataSize > 65535) {
    throw new Error(`voucher message too long: ${messageDataSize}`);
  }
  const currentInstruction = 65535;
  const data = new Uint8Array(messageDataOffset + messageDataSize);
  data[0] = 1;
  data[1] = 0;
  data.set(U16_LE(signatureOffset), 2);
  data.set(U16_LE(currentInstruction), 4);
  data.set(U16_LE(publicKeyOffset), 6);
  data.set(U16_LE(currentInstruction), 8);
  data.set(U16_LE(messageDataOffset), 10);
  data.set(U16_LE(messageDataSize), 12);
  data.set(U16_LE(currentInstruction), 14);
  data.set(args.signer, publicKeyOffset);
  data.set(args.signature, signatureOffset);
  data.set(args.message, messageDataOffset);
  return {
    accounts: [],
    data,
    programAddress: ED25519_PROGRAM_ADDRESS
  };
}
function encodeVoucherMessageBytes2(args) {
  const channelBytes = getBase58Encoder().encode(args.channelId);
  if (channelBytes.byteLength !== 32) {
    throw new Error(`channelId must decode to 32 bytes; got ${channelBytes.byteLength}`);
  }
  const out = new Uint8Array(50);
  out.set(VOUCHER_MAGIC, 0);
  out.set(channelBytes, 2);
  out.set(getU64Encoder().encode(args.cumulativeAmount), 34);
  out.set(getI64Encoder().encode(args.expiresAt), 42);
  return out;
}
function buildSettleAndSealInstructions2(args) {
  const programId = args.programId ?? PAYMENT_CHANNELS_PROGRAM_ID2;
  const channel = address2(args.channelId);
  const instructions = [];
  let cumulativeAmount = 0n;
  let expiresAt = 0n;
  let hasVoucher = 0;
  if (args.voucher) {
    const { signed, authorizedSigner } = args.voucher;
    cumulativeAmount = parseU64String(signed.voucher.cumulativeAmount, "voucher.cumulativeAmount");
    expiresAt = toBigInt(signed.voucher.expiresAt ?? 0);
    hasVoucher = 1;
    const signerBytes = getBase58Encoder().encode(authorizedSigner);
    if (signerBytes.byteLength !== 32) {
      throw new Error(`authorizedSigner must decode to 32 bytes; got ${signerBytes.byteLength}`);
    }
    const signatureBytes = getBase58Encoder().encode(signed.signature);
    if (signatureBytes.byteLength !== 64) {
      throw new Error(`voucher signature must decode to 64 bytes; got ${signatureBytes.byteLength}`);
    }
    const message = encodeVoucherMessageBytes2({
      channelId: signed.voucher.channelId,
      cumulativeAmount,
      expiresAt
    });
    instructions.push(buildEd25519VerifyInstruction({
      message,
      signature: signatureBytes,
      signer: signerBytes
    }));
  }
  const ix = getSettleAndSealInstruction({
    channel,
    instructionsSysvar: INSTRUCTIONS_SYSVAR_ADDRESS,
    // The channel payee (merchant) signs the seal.
    payee: args.merchantSigner,
    // The program reads the voucher from the ed25519 precompile; the
    // settle_and_seal args carry only the hasVoucher flag.
    settleAndSealArgs: { hasVoucher }
  }, { programAddress: programId });
  instructions.push(ix);
  return {
    instructions,
    requiresEd25519Precompile: hasVoucher === 1
  };
}
async function buildDistributeInstruction2(args) {
  const programId = args.programId ?? PAYMENT_CHANNELS_PROGRAM_ID2;
  const mint = address2(args.mint);
  const tokenProgram = address2(args.tokenProgram);
  const channel = address2(args.channelState.channelId);
  const payer = address2(args.payerAddr ?? args.channelState.payer);
  const payee = address2(args.channelState.payee);
  if (!args.rentPayer) {
    throw new Error("buildDistributeInstruction: rentPayer is required (the operator recorded as the channel rentPayer at open)");
  }
  const rentPayer = address2(args.rentPayer);
  const [channelTokenAccount] = await findAssociatedTokenPda2({ mint, owner: channel, tokenProgram });
  const [payerTokenAccount] = await findAssociatedTokenPda2({ mint, owner: payer, tokenProgram });
  const [payeeTokenAccount] = await findAssociatedTokenPda2({ mint, owner: payee, tokenProgram });
  const [eventAuthority] = await findEventAuthorityPda({ programAddress: programId });
  const treasury = deriveTreasuryAddress();
  const [treasuryTokenAccount] = await findAssociatedTokenPda2({ mint, owner: treasury, tokenProgram });
  const recipientTokenAccounts = [];
  const distributions = [];
  for (const split of args.splits) {
    const recipient = address2(split.recipient);
    const [recipientAta] = await findAssociatedTokenPda2({ mint, owner: recipient, tokenProgram });
    recipientTokenAccounts.push(recipientAta);
    distributions.push({ bps: split.bps, recipient });
  }
  const ix = getDistributeInstruction({
    channel,
    channelTokenAccount,
    distributeArgs: { recipients: distributions },
    eventAuthority,
    mint,
    payee,
    payeeTokenAccount,
    payer,
    payerTokenAccount,
    recipientTokenAccounts,
    rentPayer,
    selfProgram: programId,
    tokenProgram,
    treasuryTokenAccount
  }, { programAddress: programId });
  return ix;
}
async function verifyOpenTx(args) {
  const { openPayload, expected } = args;
  if (!openPayload.transaction)
    throw new Error("openPayload.transaction is required");
  const txBytes = getBase64Codec3().encode(openPayload.transaction);
  const decoded = getTransactionDecoder3().decode(txBytes);
  const message = getCompiledTransactionMessageDecoder2().decode(decoded.messageBytes);
  assertVersionedTransactionMessage(message);
  if (!expected.recentBlockhash) {
    throw new Error("verifyOpenTx: expected.recentBlockhash is required");
  }
  if (message.lifetimeToken !== expected.recentBlockhash) {
    throw new Error("verifyOpenTx: open transaction does not use the challenged recentBlockhash");
  }
  if (message.addressTableLookups && message.addressTableLookups.length > 0) {
    throw new Error("verifyOpenTx: address-lookup tables are not permitted in an open transaction \u2014 all accounts must be static");
  }
  const programIdStr = expected.channelProgram ?? PAYMENT_CHANNELS_PROGRAM_ID2;
  const expectedMint = expected.mint ?? resolveStablecoinMint(expected.currency, expected.network ?? "mainnet") ?? expected.currency;
  if (!expectedMint) {
    throw new Error("verifyOpenTx: could not resolve mint from currency/network");
  }
  let openIx;
  for (const ix of message.instructions) {
    const programIxAddr = message.staticAccounts[ix.programAddressIndex];
    if (programIxAddr !== programIdStr) {
      if (programIxAddr !== "ComputeBudget111111111111111111111111111111") {
        throw new Error(`verifyOpenTx: unexpected instruction program ${String(programIxAddr)}`);
      }
      continue;
    }
    if (!ix.data || ix.data.length < 1)
      continue;
    if (ix.data[0] !== OPEN_DISCRIMINATOR)
      continue;
    if (openIx)
      throw new Error("verifyOpenTx: transaction contains more than one open instruction");
    openIx = { accountIndices: ix.accountIndices ?? [], data: ix.data };
  }
  if (!openIx) {
    throw new Error("verifyOpenTx: no payment-channels open instruction found");
  }
  const indices = openIx.accountIndices;
  if (indices.length < 9) {
    throw new Error(`verifyOpenTx: open instruction has too few accounts (${indices.length})`);
  }
  const accountAt = (slot, label) => {
    const idx = indices[slot];
    const addr = idx === void 0 ? void 0 : message.staticAccounts[idx];
    if (!addr)
      throw new Error(`verifyOpenTx: missing account at slot ${slot} (${label})`);
    return addr;
  };
  const payerAddr = accountAt(0, "payer");
  const rentPayerAddr = accountAt(1, "rentPayer");
  const payeeAddr = accountAt(2, "payee");
  const mintAddr = accountAt(3, "mint");
  const authorizedSignerAddr = accountAt(4, "authorizedSigner");
  const channelAddr = accountAt(5, "channel");
  const channelTokenAccountAddr = accountAt(7, "channelTokenAccount");
  const tokenProgramAddr = accountAt(8, "tokenProgram");
  if (message.staticAccounts[0] !== expected.feePayer) {
    throw new Error(`verifyOpenTx: transaction fee payer ${String(message.staticAccounts[0])} != expected ${expected.feePayer}`);
  }
  const signatures = decoded.signatures;
  const payerSignature = signatures[payerAddr];
  if (!payerSignature || payerSignature.every((byte) => byte === 0)) {
    throw new Error("verifyOpenTx: channel payer must sign the open transaction");
  }
  if (payeeAddr !== expected.recipient) {
    throw new Error(`verifyOpenTx: payee ${payeeAddr} != expected recipient ${expected.recipient}`);
  }
  if (mintAddr !== expectedMint) {
    throw new Error(`verifyOpenTx: mint ${mintAddr} != expected mint ${expectedMint}`);
  }
  if (expected.tokenProgram && tokenProgramAddr !== expected.tokenProgram) {
    throw new Error(`verifyOpenTx: tokenProgram ${tokenProgramAddr} != expected ${expected.tokenProgram}`);
  }
  if (authorizedSignerAddr !== expected.authorizedSigner) {
    throw new Error(`verifyOpenTx: authorizedSigner ${authorizedSignerAddr} != expected ${expected.authorizedSigner}`);
  }
  if (!expected.rentPayer) {
    throw new Error("verifyOpenTx: expected.rentPayer is required");
  }
  if (rentPayerAddr !== expected.rentPayer) {
    throw new Error(`verifyOpenTx: rentPayer ${rentPayerAddr} != expected ${expected.rentPayer}`);
  }
  const decodedOpen = getOpenInstructionDataDecoder().decode(openIx.data);
  const { deposit, gracePeriod, openSlot, recipients, salt } = decodedOpen.openArgs;
  if (deposit === 0n) {
    throw new Error("verifyOpenTx: deposit must be greater than zero");
  }
  const declaredDeposit = BigInt(openPayload.depositAmount);
  if (deposit !== declaredDeposit) {
    throw new Error(`verifyOpenTx: deposit ${deposit} != payload depositAmount ${declaredDeposit}`);
  }
  if (expected.minimumDeposit !== void 0 && deposit < expected.minimumDeposit) {
    throw new Error(`verifyOpenTx: deposit ${deposit} is below minimumDeposit ${expected.minimumDeposit}`);
  }
  if (openSlot !== expected.openSlot || openSlot !== BigInt(openPayload.openSlot)) {
    throw new Error(`verifyOpenTx: openSlot ${openSlot} does not match the payload`);
  }
  if (gracePeriod !== openPayload.gracePeriodSeconds) {
    throw new Error(`verifyOpenTx: gracePeriod ${gracePeriod} != payload gracePeriodSeconds ${openPayload.gracePeriodSeconds}`);
  }
  if (salt !== BigInt(openPayload.salt)) {
    throw new Error(`verifyOpenTx: salt ${salt} != payload salt ${openPayload.salt}`);
  }
  if (payerAddr !== openPayload.payer || payeeAddr !== openPayload.payee || mintAddr !== openPayload.mint) {
    throw new Error("verifyOpenTx: payer, payee, or mint does not match the open payload");
  }
  const declaredSplits = openPayload.distributionSplits ?? [];
  if (recipients.length !== declaredSplits.length || recipients.some((entry, index) => entry.recipient !== declaredSplits[index]?.recipient || entry.bps !== declaredSplits[index]?.shareBps)) {
    throw new Error("verifyOpenTx: distributionSplits do not match the open instruction");
  }
  const challengedSplits = expected.splits;
  if (recipients.length !== challengedSplits.length || recipients.some((entry, index) => entry.recipient !== challengedSplits[index]?.recipient || entry.bps !== challengedSplits[index]?.shareBps)) {
    throw new Error("verifyOpenTx: distributionSplits do not match the challenge");
  }
  const programAddress2 = programIdStr;
  const [derivedChannel] = await getProgramDerivedAddress({
    programAddress: programAddress2,
    seeds: [
      getUtf8Encoder().encode("channel"),
      getAddressEncoder().encode(address2(payerAddr)),
      getAddressEncoder().encode(address2(payeeAddr)),
      getAddressEncoder().encode(address2(mintAddr)),
      getAddressEncoder().encode(address2(authorizedSignerAddr)),
      getU64Encoder().encode(salt),
      getU64Encoder().encode(openSlot)
    ]
  });
  if (derivedChannel !== channelAddr) {
    throw new Error(`verifyOpenTx: channel PDA ${channelAddr} != derived ${derivedChannel}`);
  }
  if (openPayload.channelId !== channelAddr) {
    throw new Error(`verifyOpenTx: openPayload.channelId ${openPayload.channelId} != tx channel ${channelAddr}`);
  }
  const [expectedEscrow] = await findAssociatedTokenPda2({
    mint: address2(mintAddr),
    owner: address2(channelAddr),
    tokenProgram: address2(tokenProgramAddr)
  });
  if (expectedEscrow !== channelTokenAccountAddr) {
    throw new Error(`verifyOpenTx: channel token account ${channelTokenAccountAddr} is not the canonical ATA`);
  }
  return { channelId: channelAddr, deposit, gracePeriod, openSlot, payer: payerAddr, salt };
}
async function submitTopUpTx(args) {
  const decoded = getTransactionDecoder3().decode(getBase64Codec3().encode(args.transaction));
  const message = getCompiledTransactionMessageDecoder2().decode(decoded.messageBytes);
  assertVersionedTransactionMessage(message);
  if (message.addressTableLookups?.length)
    throw new Error("submitTopUpTx: address lookup tables are not permitted");
  let found = false;
  for (const ix of message.instructions) {
    const program = message.staticAccounts[ix.programAddressIndex];
    if (program === "ComputeBudget111111111111111111111111111111")
      continue;
    if (program !== args.channelProgram || !ix.data || found) {
      throw new Error(`submitTopUpTx: unexpected instruction program ${String(program)}`);
    }
    const decodedData = getTopUpInstructionDataDecoder().decode(ix.data);
    const indices = ix.accountIndices ?? [];
    const payer = message.staticAccounts[indices[0] ?? -1];
    const channel = message.staticAccounts[indices[1] ?? -1];
    if (payer !== args.payer || channel !== args.channelId) {
      throw new Error("submitTopUpTx: payer or channel does not match persisted channel state");
    }
    if (decodedData.topUpArgs.amount !== args.additionalAmount) {
      throw new Error("submitTopUpTx: amount does not match additionalAmount");
    }
    found = true;
  }
  if (!found)
    throw new Error("submitTopUpTx: top-up instruction not found");
  let signature;
  try {
    signature = await args.rpc.sendTransaction(args.transaction, { encoding: "base64", skipPreflight: false }).send();
  } catch (error) {
    const landed = getSignatureFromTransaction2(decoded);
    const [status] = (await args.rpc.getSignatureStatuses([landed]).send()).value;
    if (!status || status.err)
      throw error;
    signature = landed;
  }
  await waitForSignatureConfirmation({ context: "submitTopUpTx", rpc: args.rpc, signature });
  const account = await fetchChannel(args.rpc, address2(args.channelId), { commitment: "confirmed" });
  if (account.data.status !== Number(ChannelStatus.Open) || account.data.deposit < args.currentDeposit + args.additionalAmount) {
    throw new Error("submitTopUpTx: confirmed channel state does not reflect the submitted top-up");
  }
  return signature;
}
function transactionSignatureFromWire(transaction) {
  return getSignatureFromTransaction2(getTransactionDecoder3().decode(getBase64Codec3().encode(transaction)));
}
async function waitForSignatureConfirmation(args) {
  const context = args.context ?? "waitForSignatureConfirmation";
  const timeoutMs = args.options?.timeoutMs ?? 3e4;
  const pollIntervalMs = args.options?.pollIntervalMs ?? 1e3;
  const deadline = Date.now() + timeoutMs;
  for (; ; ) {
    if (args.options?.signal?.aborted) {
      throw new Error(`${context}: aborted while waiting for tx ${args.signature} confirmation`);
    }
    const [status] = (await args.rpc.getSignatureStatuses([args.signature]).send()).value;
    if (status) {
      if (status.err) {
        throw new Error(`${context}: tx ${args.signature} failed on-chain: ${JSON.stringify(status.err)}`);
      }
      const level = status.confirmationStatus;
      if (level === void 0 || level === null || level === "confirmed" || level === "finalized") {
        return;
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(`${context}: timed out waiting for tx ${args.signature} confirmation`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
async function submitOpenTx(args) {
  const verified = await verifyOpenTx(args);
  if (!args.openPayload.transaction) {
    throw new Error("submitOpenTx: openPayload.transaction is required");
  }
  let wire = args.openPayload.transaction;
  if (args.payerSigner) {
    const decoded = getTransactionDecoder3().decode(getBase64Codec3().encode(wire));
    if (decoded.signatures[args.payerSigner.address] !== void 0) {
      wire = await coSignBase64Transaction(args.payerSigner, wire);
    }
  }
  const assertConfirmedChannelMatchesOpen = async () => {
    const account = await fetchChannel(args.rpc, address2(verified.channelId), {
      commitment: "confirmed"
    });
    const channel = account.data;
    const expectedMint = args.expected.mint ?? resolveStablecoinMint(args.expected.currency, args.expected.network ?? "mainnet") ?? args.expected.currency;
    if (channel.status !== Number(ChannelStatus.Open) || channel.deposit !== verified.deposit || channel.salt !== verified.salt || channel.openSlot !== verified.openSlot || channel.gracePeriod !== verified.gracePeriod || channel.payer !== verified.payer || channel.payee !== args.expected.recipient || channel.mint !== expectedMint || channel.authorizedSigner !== args.expected.authorizedSigner || channel.rentPayer !== args.expected.rentPayer) {
      throw new Error("submitOpenTx: confirmed channel state does not match the verified open transaction");
    }
  };
  let signature;
  try {
    signature = await args.rpc.sendTransaction(wire, { encoding: "base64", skipPreflight: false }).send();
    await waitForSignatureConfirmation({
      context: "submitOpenTx",
      options: args.confirm,
      rpc: args.rpc,
      signature
    });
  } catch (error) {
    signature = getSignatureFromTransaction2(getTransactionDecoder3().decode(getBase64Codec3().encode(wire)));
    try {
      await assertConfirmedChannelMatchesOpen();
    } catch {
      throw error;
    }
    return { ...verified, signature };
  }
  await assertConfirmedChannelMatchesOpen();
  return { ...verified, signature };
}
async function submitSettleAndDistribute(args) {
  const tokenProgram = args.tokenProgram ?? (args.currency ? defaultTokenProgramForCurrency(args.currency, args.network) : void 0);
  if (!tokenProgram) {
    throw new Error("submitSettleAndDistribute: tokenProgram or currency is required");
  }
  const settle = buildSettleAndSealInstructions2({
    channelId: args.channelId,
    merchantSigner: args.signer,
    programId: args.programId,
    voucher: args.voucher
  });
  const distribute = await buildDistributeInstruction2({
    channelState: { channelId: args.channelId, payee: args.payee, payer: args.payer },
    mint: args.mint,
    payerAddr: args.payer,
    programId: args.programId,
    rentPayer: args.rentPayer,
    splits: args.splits,
    tokenProgram
  });
  const instructions = [...settle.instructions, distribute];
  const wire = await args.buildAndSignWireTransaction(instructions);
  const signature = await args.rpc.sendTransaction(wire, { encoding: "base64" }).send();
  return { instructions, signature };
}
function deriveTreasuryAddress() {
  return getBase58FromBytes(TREASURY_OWNER_BYTES);
}
function getBase58FromBytes(bytes) {
  return bytesToBase58(bytes);
}
var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bytesToBase58(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0)
    zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i] ?? 0;
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = carry / 58 | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = carry / 58 | 0;
    }
  }
  let out = "";
  for (let i = 0; i < zeros; i++)
    out += "1";
  for (let i = digits.length - 1; i >= 0; i--) {
    const ch = BASE58_ALPHABET[digits[i] ?? 0];
    out += ch ?? "1";
  }
  return out;
}
function parseU64String(value, name) {
  if (!/^\d+$/.test(value))
    throw new Error(`${name} is not an unsigned integer string: ${value}`);
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > (1n << 64n) - 1n)
    throw new Error(`${name} outside u64 range`);
  return parsed;
}
function toBigInt(value) {
  if (typeof value === "bigint")
    return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new Error(`value ${value} is not a safe integer`);
    return BigInt(value);
  }
  return BigInt(value);
}

// ../mpp/dist/server/session/store.js
var CHANNEL_STATE_SCHEMA_VERSION = 1;
function createMemorySessionStore() {
  const data = /* @__PURE__ */ new Map();
  const locks2 = /* @__PURE__ */ new Map();
  function withLock(channelId, work) {
    const previous = locks2.get(channelId) ?? Promise.resolve();
    const next = previous.then(work, work);
    locks2.set(channelId, next.catch(() => void 0));
    return next;
  }
  return {
    deleteChannel(channelId) {
      data.delete(channelId);
      return Promise.resolve();
    },
    getChannel(channelId) {
      return Promise.resolve(data.get(channelId));
    },
    listChannels(filter) {
      const all = Array.from(data.values());
      if (!filter)
        return Promise.resolve(all);
      return Promise.resolve(all.filter((state) => {
        if (filter.sealed !== void 0 && state.sealed !== filter.sealed) {
          return false;
        }
        if (filter.closePending !== void 0) {
          const isCloseRequested = state.closeRequestedAt !== void 0;
          if (filter.closePending !== isCloseRequested)
            return false;
        }
        return true;
      }));
    },
    async markSealed(channelId) {
      return await withLock(channelId, () => {
        const current = data.get(channelId);
        if (!current) {
          throw new Error(`Channel ${channelId} not found`);
        }
        const next = { ...current, sealed: true };
        data.set(channelId, next);
        return Promise.resolve(next);
      });
    },
    async updateChannel(channelId, mutator) {
      return await withLock(channelId, async () => {
        const current = data.get(channelId);
        const nextState = await mutator(current);
        data.set(channelId, nextState);
        return nextState;
      });
    }
  };
}

// ../mpp/dist/server/session/voucher.js
async function verifyVoucherForChannel(args) {
  const { state, signed, deposit } = args;
  const { voucher: data } = signed;
  if (signed.signatureType !== "ed25519" || signed.signer !== state.authorizedSigner) {
    return reject("invalid-signature", "voucher signer does not match the channel authorized signer");
  }
  let newCumulative;
  try {
    newCumulative = parseU642(data.cumulativeAmount);
  } catch (error) {
    return reject("invalid-cumulative", errorMessage(error));
  }
  if (state.sealed) {
    return reject("channel-sealed", `Channel ${state.channelId} is already sealed`);
  }
  if (state.closeRequestedAt !== void 0) {
    return reject("channel-close-pending", `Channel ${state.channelId} close is pending \u2014 no further vouchers accepted`);
  }
  if (newCumulative === state.cumulative && state.highestVoucherSignature === signed.signature) {
    const ok = await safeVerifySignature(signed, state.authorizedSigner);
    if (!ok.ok)
      return ok.reject;
    const expiryReject2 = checkExpiry(toBigInt2(data.expiresAt ?? 0), currentTime(args.nowSeconds), args.settlementWindow);
    if (expiryReject2)
      return expiryReject2;
    return { newCumulative, status: "replayed" };
  }
  if (newCumulative <= state.cumulative) {
    return reject("cumulative-not-monotonic", `Voucher cumulative ${newCumulative} must exceed watermark ${state.cumulative}`);
  }
  if (newCumulative > deposit) {
    return reject("exceeds-deposit", `Voucher cumulative ${newCumulative} exceeds deposit ${deposit}`);
  }
  const delta = newCumulative - state.cumulative;
  const minDelta = args.minVoucherDelta ?? 0n;
  if (minDelta > 0n && delta < minDelta) {
    return reject("below-min-delta", `Voucher delta ${delta} is below minimum ${minDelta}`);
  }
  const sigCheck = await safeVerifySignature(signed, state.authorizedSigner);
  if (!sigCheck.ok)
    return sigCheck.reject;
  const expiresAt = toBigInt2(data.expiresAt ?? 0);
  const expiryReject = checkExpiry(expiresAt, currentTime(args.nowSeconds), args.settlementWindow);
  if (expiryReject)
    return expiryReject;
  return {
    newCumulative,
    newExpiresAt: expiresAt,
    newSignature: signed.signature,
    status: "accepted"
  };
}
function reject(reason, detail) {
  return { detail, reason, status: "rejected" };
}
function checkExpiry(expiresAt, now, settlementWindow) {
  if (expiresAt === 0n)
    return void 0;
  if (expiresAt <= now) {
    return reject("expired", `Voucher expired at ${expiresAt} (now ${now})`);
  }
  const window = settlementWindow ?? 0n;
  if (window > 0n && expiresAt < now + window) {
    return reject("expires-within-settlement-window", `Voucher expiresAt ${expiresAt} is within the settlement window (now ${now} + window ${window} = ${now + window}); it may expire before settlement lands`);
  }
  return void 0;
}
async function safeVerifySignature(signed, authorizedSigner) {
  try {
    const valid = await verifyVoucherSignature({
      signatureBase58: signed.signature,
      signerBase58: authorizedSigner,
      voucher: signed.voucher
    });
    if (!valid) {
      return { ok: false, reject: reject("invalid-signature", "Voucher signature verification failed") };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reject: reject("invalid-signature", errorMessage(error))
    };
  }
}
function parseU642(value) {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid cumulative in voucher: ${value}`);
  }
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > (1n << 64n) - 1n) {
    throw new Error(`Cumulative ${value} outside u64 range`);
  }
  return parsed;
}
function toBigInt2(value) {
  if (typeof value === "bigint")
    return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new Error(`expiresAt is not a safe integer: ${value}`);
    return BigInt(value);
  }
  return BigInt(value);
}
function currentTime(override) {
  if (override !== void 0)
    return override;
  return BigInt(Math.floor(Date.now() / 1e3));
}
function errorMessage(error) {
  if (error instanceof Error)
    return error.message;
  return String(error);
}

// ../mpp/dist/server/session/wire-tx.js
import { appendTransactionMessageInstructions, createTransactionMessage, getBase64EncodedWireTransaction as getBase64EncodedWireTransaction2, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners } from "@solana/kit";
async function buildAndSignWireTransaction(rpc, signer, instructions) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(signer, m), (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m), (m) => appendTransactionMessageInstructions(instructions, m));
  const signed = await signTransactionMessageWithSigners(message);
  return getBase64EncodedWireTransaction2(signed);
}

// ../mpp/dist/server/Session.js
var DEFAULT_DIRECTIVE_EXPIRES_AT = 4102444800;
var defaultStores = /* @__PURE__ */ new WeakMap();
function resolveSessionStore(parameters) {
  if (parameters.store)
    return parameters.store;
  const existing = defaultStores.get(parameters);
  if (existing)
    return existing;
  const created = createMemorySessionStore();
  defaultStores.set(parameters, created);
  return created;
}
function session2(parameters) {
  const { recipient, signer, amount, suggestedDeposit, minimumDeposit, currency, decimals, network = "mainnet", channelProgram, voucherSigner = "client", distributionSplits, rpc, idleTimeoutOptionsSeconds, idleTimeoutSeconds = 300, minVoucherDelta, feePayer = false, feePayerSigner, gracePeriodSeconds, settlementWindowSeconds, operatorVoucherSigner } = parameters;
  if (amount <= 0n) {
    throw new Error("amount must be positive");
  }
  if (!rpc)
    throw new Error("rpc is required for session funding verification");
  if (!isTransactionPartialSigner2(signer)) {
    throw new Error("signer must implement signTransactions()");
  }
  if (feePayerSigner && !isTransactionPartialSigner2(feePayerSigner)) {
    throw new Error("feePayerSigner must implement signTransactions()");
  }
  if (feePayer && !feePayerSigner)
    throw new Error("feePayerSigner is required when feePayer is true");
  if (distributionSplits && distributionSplits.length > 32) {
    throw new Error("distributionSplits cannot exceed 32 entries");
  }
  if (idleTimeoutOptionsSeconds)
    validateIdleTimeoutOptions(idleTimeoutOptionsSeconds);
  resolveIdleTimeoutSeconds({ defaultSeconds: idleTimeoutSeconds, options: idleTimeoutOptionsSeconds });
  if (voucherSigner === "operator" && !operatorVoucherSigner) {
    throw new Error("operatorVoucherSigner is required when voucherSigner is operator");
  }
  const operator = operatorVoucherSigner?.address;
  const store = resolveSessionStore(parameters);
  const resolvedProgramId = channelProgram ?? PAYMENT_CHANNELS_PROGRAM_ID2;
  const resolvedMint = resolveStablecoinMint(currency, network);
  if (!resolvedMint)
    throw new Error("session currency must be an SPL token mint; use wrapped SOL instead of SOL");
  const resolvedDecimals = decimals ?? (stablecoinSymbolForCurrency(resolvedMint) ? 6 : void 0);
  if (resolvedDecimals === void 0)
    throw new Error("decimals is required for a session SPL token mint");
  if (!Number.isInteger(resolvedDecimals) || resolvedDecimals < 0 || resolvedDecimals > 9) {
    throw new Error("decimals must be an integer from 0 to 9");
  }
  const tokenProgram = parameters.tokenProgram ?? defaultTokenProgramForCurrency(currency, network);
  const lifecycleRef = { value: void 0 };
  if (idleTimeoutSeconds > 0) {
    lifecycleRef.value = createLifecycle(store, async (channelId) => {
      try {
        await closeAndSettleChannel({
          channelId,
          currency,
          decimals,
          merchantSigner: signer,
          mint: resolvedMint,
          network,
          programId: resolvedProgramId,
          recipient,
          rentPayer: feePayerSigner?.address,
          rpc,
          splits: distributionSplits?.map((split) => ({ bps: split.shareBps, recipient: split.recipient })),
          store,
          tokenProgram
        });
      } catch (error) {
        console.warn(`[solana-mpp] idle-close settle failed for ${channelId}:`, error);
      }
    }, idleTimeoutSeconds * 1e3);
  }
  const method = Method2.toServer(session, {
    defaults: {
      amount: amount.toString(),
      currency: resolvedMint,
      methodDetails: {
        channelProgram: resolvedProgramId.toString(),
        network
      },
      recipient
    },
    async request({ credential, request }) {
      const resumeChannelId = request.methodDetails?.channelId;
      const openContext = resumeChannelId || credential ? void 0 : await challengeOpenTransactionContext(parameters.blockhashCache, rpc);
      const challengeRequest = {
        amount: request.amount ?? amount.toString(),
        currency: resolvedMint,
        ...request.description ? { description: request.description } : {},
        ...request.externalId ? { externalId: request.externalId } : {},
        ...minimumDeposit !== void 0 ? { minimumDeposit: minimumDeposit.toString() } : {},
        recipient,
        ...suggestedDeposit !== void 0 ? { suggestedDeposit: suggestedDeposit.toString() } : {},
        ...parameters.unitType ? { unitType: parameters.unitType } : {},
        methodDetails: {
          ...resumeChannelId ? { channelId: resumeChannelId } : {},
          channelProgram: resolvedProgramId.toString(),
          decimals: resolvedDecimals,
          ...distributionSplits?.length ? { distributionSplits: [...distributionSplits] } : {},
          ...feePayer ? { feePayer: true, feePayerKey: feePayerSigner?.address } : {},
          ...gracePeriodSeconds !== void 0 ? { gracePeriodSeconds } : {},
          ...idleTimeoutOptionsSeconds ? { idleTimeoutOptionsSeconds: [...idleTimeoutOptionsSeconds] } : {},
          idleTimeoutSeconds,
          ...minVoucherDelta !== void 0 && minVoucherDelta > 0n ? { minVoucherDelta: minVoucherDelta.toString() } : {},
          network,
          ...operator ? { operator } : {},
          ...openContext ? { recentBlockhash: openContext.blockhash, recentSlot: openContext.slot.toString() } : {},
          tokenProgram,
          voucherSigner
        }
      };
      return challengeRequest;
    },
    async verify({ credential, envelope }) {
      const cred = credential;
      const action = cred.payload.action;
      switch (action) {
        case "open":
          assertChallengeOpenNotExpired(cred.challenge.expires);
          return await handleOpen({
            challengeId: cred.challenge.id,
            currency: resolvedMint,
            distributionSplits,
            externalId: cred.challenge.request.externalId,
            feePayer,
            feePayerSigner,
            gracePeriodSeconds,
            idleTimeoutOptionsSeconds,
            idleTimeoutSeconds,
            lifecycle: lifecycleRef.value,
            minimumDeposit,
            mint: resolvedMint,
            network,
            // Verified outer challenge facts the open is bound to
            // (mirrors the Rust SessionOpenContext): the challenged
            // blockhash + slot flow from the (HMAC-verified) echoed
            // challenge into open verification.
            openContext: challengedOpenContext(cred.challenge.request),
            operator,
            payload: cred.payload,
            programId: resolvedProgramId,
            recipient,
            rpc,
            store,
            tokenProgram,
            voucherSigner
          });
        case "use":
          if (!operatorVoucherSigner) {
            throw new Error("use is only valid when voucherSigner is operator");
          }
          return await handleUse({
            challengeId: cred.challenge.id,
            externalId: cred.challenge.request.externalId,
            idempotencyKey: envelope?.capturedRequest.headers.get("Idempotency-Key") ?? "",
            lifecycle: lifecycleRef.value,
            operatorVoucherSigner,
            payload: cred.payload,
            price: parseU64String2(cred.challenge.request.amount, "amount"),
            store
          });
        case "voucher":
          return await handleVoucher({
            challengeId: cred.challenge.id,
            externalId: cred.challenge.request.externalId,
            lifecycle: lifecycleRef.value,
            minVoucherDelta,
            payload: cred.payload,
            price: parseU64String2(cred.challenge.request.amount, "amount"),
            settlementWindow: settlementWindowSeconds,
            store
          });
        case "topUp":
          return await handleTopUp({
            challengeId: cred.challenge.id,
            channelProgram: resolvedProgramId.toString(),
            externalId: cred.challenge.request.externalId,
            lifecycle: lifecycleRef.value,
            payload: cred.payload,
            rpc,
            store
          });
        case "close":
          return await handleClose({
            challengeId: cred.challenge.id,
            currency,
            decimals: resolvedDecimals,
            externalId: cred.challenge.request.externalId,
            lifecycle: lifecycleRef.value,
            merchantSigner: signer,
            mint: resolvedMint,
            network,
            payload: cred.payload,
            programId: resolvedProgramId,
            recipient,
            rentPayer: feePayerSigner?.address,
            rpc,
            settlementWindow: settlementWindowSeconds,
            splits: distributionSplits?.map((split) => ({ bps: split.shareBps, recipient: split.recipient })),
            store,
            tokenProgram
          });
        default:
          throw new Error(`Unknown session action: ${String(action)}`);
      }
    }
  });
  return method;
}
function assertChallengeOpenNotExpired(expires) {
  if (expires === void 0)
    return;
  const expiresAt = Date.parse(expires);
  if (Number.isNaN(expiresAt))
    throw new Error("challenge expires must be an RFC3339 timestamp");
  if (expiresAt <= Date.now())
    throw new Error(`challenge expired at ${expires}`);
}
function challengedOpenContext(request) {
  const details = request.methodDetails;
  if (!details.recentBlockhash || details.recentSlot === void 0) {
    throw new Error("open requires a challenge carrying recentBlockhash/recentSlot; only a new-channel challenge provides them");
  }
  return {
    recentBlockhash: details.recentBlockhash,
    recentSlot: parseU64String2(details.recentSlot, "methodDetails.recentSlot")
  };
}
async function challengeOpenTransactionContext(cache, rpc) {
  const cached = cache?.get();
  if (cached)
    return { blockhash: cached.blockhash, slot: BigInt(cached.slot) };
  const candidate = rpc;
  if (typeof candidate.getLatestBlockhash !== "function") {
    throw new Error("session challenge requires recentBlockhash/recentSlot; configure a blockhashCache or an rpc that supports getLatestBlockhash");
  }
  let response;
  try {
    response = await candidate.getLatestBlockhash({ commitment: "confirmed" }).send();
  } catch (error) {
    throw new Error(`failed to fetch recentBlockhash/recentSlot for session challenge: ${errorMessage2(error)}`);
  }
  return { blockhash: response.value.blockhash, slot: BigInt(response.context.slot) };
}
session2.routes = function routes(parameters) {
  const store = resolveSessionStore(parameters);
  const currency = resolveStablecoinMint(parameters.currency, parameters.network ?? "mainnet");
  if (!currency)
    throw new Error("session currency must be an SPL token mint; use wrapped SOL instead of SOL");
  return {
    async commit(request) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object")
        return jsonError(400, "invalid request body");
      if (!body.deliveryId)
        return jsonError(400, "deliveryId required");
      if (!body.voucher)
        return jsonError(400, "voucher required");
      try {
        const receipt = await commitDelivery(store, {
          deliveryId: body.deliveryId,
          settlementWindow: parameters.settlementWindowSeconds,
          voucher: body.voucher
        });
        return Response.json(receipt, { status: 200 });
      } catch (error) {
        return jsonError(400, errorMessage2(error));
      }
    },
    async deliveries(request) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object")
        return jsonError(400, "invalid request body");
      if (!body.sessionId)
        return jsonError(400, "sessionId required");
      const amount = parseU64String2(body.amount, "amount");
      if (amount === 0n)
        return jsonError(400, "amount must be positive");
      try {
        const deliveriesUrl = new URL(request.url);
        const commitPath = deliveriesUrl.pathname.replace(/\/deliveries\/?$/, "/commit");
        const directive = await reserveDelivery(store, {
          amount,
          commitUrl: commitPath,
          currency,
          deliveryId: body.deliveryId,
          expiresAt: body.expiresAt ?? DEFAULT_DIRECTIVE_EXPIRES_AT,
          proof: body.proof,
          sessionId: body.sessionId
        });
        return Response.json(directive, { status: 200 });
      } catch (error) {
        return jsonError(400, errorMessage2(error));
      }
    }
  };
};
async function handleOpen(args) {
  const { payload } = args;
  const authorizedSigner = address3(payload.authorizedSigner);
  if (isOffCurveAddress(authorizedSigner)) {
    throw new Error("open authorizedSigner must be an on-curve Ed25519 public key");
  }
  if (args.voucherSigner === "operator" && (!args.operator || payload.authorizedSigner !== args.operator)) {
    throw new Error("operator voucher signing requires authorizedSigner to match the operator");
  }
  if (args.voucherSigner === "client" && payload.authentication) {
    throw new Error("authentication is only valid when voucherSigner is operator");
  }
  if (args.gracePeriodSeconds === void 0 || args.gracePeriodSeconds <= 0) {
    throw new Error("challenge must specify a positive gracePeriodSeconds");
  }
  if (payload.gracePeriodSeconds !== args.gracePeriodSeconds) {
    throw new Error("open gracePeriodSeconds does not match the challenge");
  }
  const openSlot = parseU64String2(payload.openSlot, "openSlot");
  const { recentBlockhash, recentSlot } = args.openContext;
  if (openSlot > recentSlot) {
    throw new Error(`open openSlot ${openSlot.toString()} is ahead of the challenged recentSlot ${recentSlot.toString()}`);
  }
  if (recentSlot - openSlot > OPEN_SLOT_WINDOW2) {
    throw new Error(`open openSlot ${openSlot.toString()} is outside the ${OPEN_SLOT_WINDOW2.toString()}-slot freshness window of the challenged recentSlot ${recentSlot.toString()}`);
  }
  const rentPayer = args.feePayer ? args.feePayerSigner?.address : payload.payer;
  if (!rentPayer)
    throw new Error("unable to determine channel rent payer");
  const expected = {
    authorizedSigner: payload.authorizedSigner,
    channelProgram: args.programId.toString(),
    currency: args.currency,
    feePayer: rentPayer,
    minimumDeposit: args.minimumDeposit,
    mint: args.mint,
    network: args.network,
    openSlot,
    recentBlockhash,
    recipient: args.recipient,
    rentPayer,
    splits: args.distributionSplits ?? [],
    tokenProgram: args.tokenProgram
  };
  const verified = await verifyOpenTx({ expected, openPayload: payload });
  const existingChannel = await args.store.getChannel(verified.channelId);
  if (!existingChannel) {
    const observedSlot = await currentClusterSlot(args.rpc);
    const verificationSlot = observedSlot < recentSlot ? recentSlot : observedSlot;
    if (verificationSlot - openSlot > OPEN_SLOT_WINDOW2) {
      throw new Error(`open openSlot ${openSlot.toString()} is outside the ${OPEN_SLOT_WINDOW2.toString()}-slot freshness window of the current cluster slot ${verificationSlot.toString()}`);
    }
  }
  const effectiveIdleTimeoutSeconds = resolveIdleTimeoutSeconds({
    defaultSeconds: args.idleTimeoutSeconds,
    options: args.idleTimeoutOptionsSeconds,
    selected: payload.idleTimeoutSeconds
  });
  if (args.voucherSigner === "operator") {
    const authentication = payload.authentication;
    if (!authentication)
      throw new Error("operator voucher signing requires authentication");
    if (authentication.challengeId !== args.challengeId) {
      throw new Error("session authentication challengeId does not match the open challenge");
    }
    if (authentication.payer !== verified.payer) {
      throw new Error("session authentication payer does not match the channel payer");
    }
    if (!await verifySessionAuthentication(authentication, verified.channelId)) {
      throw new Error("invalid session authentication signature");
    }
  }
  const newState = {
    authentication: payload.authentication,
    authorizedSigner: payload.authorizedSigner,
    channelId: verified.channelId,
    closeRequestedAt: void 0,
    committedDeliveries: [],
    cumulative: 0n,
    deposit: verified.deposit,
    highestVoucherExpiresAt: void 0,
    highestVoucherSignature: void 0,
    idleTimeoutSeconds: effectiveIdleTimeoutSeconds,
    lastActivityAt: Date.now(),
    nextDeliverySequence: 0n,
    openSlot: verified.openSlot,
    openingChallengeId: args.challengeId,
    payer: verified.payer,
    pendingDeliveries: [],
    processedUses: [],
    rentPayer,
    schemaVersion: CHANNEL_STATE_SCHEMA_VERSION,
    sealed: false,
    settledOnChain: 0n,
    spentAmount: 0n,
    voucherSigner: args.voucherSigner
  };
  const persisted = await args.store.updateChannel(verified.channelId, async (current) => {
    if (current) {
      if (current.sealed) {
        throw new Error(`Channel ${verified.channelId} is already sealed`);
      }
      if (payload.authorizedSigner !== current.authorizedSigner || verified.payer !== current.payer || verified.deposit !== current.deposit || verified.openSlot !== current.openSlot || rentPayer !== current.rentPayer || args.challengeId !== current.openingChallengeId || args.voucherSigner !== current.voucherSigner || !optionalSessionAuthenticationMatches(payload.authentication, current.authentication)) {
        throw new Error(`open replay does not match existing channel ${verified.channelId}`);
      }
      return { ...current, lastActivityAt: Date.now() };
    }
    await submitOpenTx({
      expected,
      openPayload: payload,
      payerSigner: args.feePayer ? args.feePayerSigner : void 0,
      rpc: args.rpc
    });
    return newState;
  });
  args.lifecycle?.touch(verified.channelId, persisted.idleTimeoutSeconds);
  return sessionReceipt(persisted, {
    challengeId: args.challengeId,
    externalId: args.externalId
  });
}
async function handleUse(args) {
  const price = args.price;
  if (price === 0n)
    throw new Error("session amount must be positive");
  if (!args.idempotencyKey)
    throw new Error("operator-signed use requires an Idempotency-Key header");
  const existing = await args.store.getChannel(args.payload.channelId);
  if (!existing)
    throw new Error(`Channel ${args.payload.channelId} not found`);
  if (!existing.openingChallengeId && !existing.authentication) {
    throw new Error("session channel predates proof binding; open a new session");
  }
  if (existing.voucherSigner !== "operator" || !existing.authentication) {
    throw new Error("use is only valid for an operator-signed channel");
  }
  if (!sessionAuthenticationMatches(args.payload.authentication, existing.authentication)) {
    throw new Error("session authentication does not match the proof bound at open");
  }
  if (!await verifySessionAuthentication(args.payload.authentication, args.payload.channelId)) {
    throw new Error("invalid session authentication signature");
  }
  let voucherSignature = "";
  let cumulative = 0n;
  let idleTimeoutSeconds;
  const finalState = await args.store.updateChannel(args.payload.channelId, async (current) => {
    if (!current)
      throw new Error(`Channel ${args.payload.channelId} not found`);
    if (current.sealed || current.closeRequestedAt !== void 0) {
      throw new Error("Channel is closed or close is pending");
    }
    const replay = current.processedUses.find((use) => use.idempotencyKey === args.idempotencyKey);
    if (replay) {
      cumulative = replay.cumulative;
      voucherSignature = replay.voucherSignature;
      idleTimeoutSeconds = current.idleTimeoutSeconds;
      return current;
    }
    cumulative = current.cumulative + price;
    idleTimeoutSeconds = current.idleTimeoutSeconds;
    if (cumulative > current.deposit)
      throw new Error("insufficient channel availability");
    const data = {
      channelId: current.channelId,
      cumulativeAmount: cumulative.toString(),
      expiresAt: DEFAULT_SESSION_EXPIRES_AT
    };
    const [signatures] = await args.operatorVoucherSigner.signMessages([
      createSignableMessage(encodeVoucherMessageLoose(data))
    ]);
    const signature = signatures?.[args.operatorVoucherSigner.address];
    if (!signature)
      throw new Error("operator voucher signer did not return a signature");
    voucherSignature = getBase58Decoder().decode(new Uint8Array(signature));
    return {
      ...current,
      cumulative,
      highestVoucherExpiresAt: BigInt(DEFAULT_SESSION_EXPIRES_AT),
      highestVoucherSignature: voucherSignature,
      lastActivityAt: Date.now(),
      processedUses: [
        ...current.processedUses,
        {
          challengeId: args.challengeId ?? "",
          cumulative,
          idempotencyKey: args.idempotencyKey,
          voucherSignature
        }
      ],
      spentAmount: current.spentAmount + price
    };
  });
  args.lifecycle?.touch(args.payload.channelId, idleTimeoutSeconds);
  return sessionReceipt(finalState, {
    challengeId: args.challengeId,
    externalId: args.externalId
  });
}
async function handleVoucher(args) {
  if (args.price === 0n)
    throw new Error("session amount must be positive");
  const signed = normalizeSignedVoucher(args.payload.voucher);
  if (args.payload.channelId !== signed.voucher.channelId) {
    throw new Error(`invalid-voucher: voucher action channelId ${args.payload.channelId} does not match the signed voucher's channelId ${signed.voucher.channelId}`);
  }
  const channelId = signed.voucher.channelId;
  const existing = await args.store.getChannel(channelId);
  if (!existing)
    throw new Error(`Channel ${channelId} not found`);
  const preflight = await verifyVoucherForChannel({
    deposit: existing.deposit,
    minVoucherDelta: args.minVoucherDelta,
    settlementWindow: args.settlementWindow,
    signed,
    state: existing
  });
  rejectIfVoucherRejected(preflight);
  const finalState = await args.store.updateChannel(channelId, async (current) => {
    if (!current)
      throw new Error(`Channel ${channelId} not found`);
    const result = await verifyVoucherForChannel({
      deposit: current.deposit,
      minVoucherDelta: args.minVoucherDelta,
      settlementWindow: args.settlementWindow,
      signed,
      state: current
    });
    if (result.status === "rejected") {
      throw new Error(`${result.reason}: ${result.detail}`);
    }
    if (result.status === "replayed") {
      return { ...current, lastActivityAt: Date.now() };
    }
    if (result.newCumulative - current.spentAmount < args.price) {
      throw new Error("insufficient authorized voucher availability");
    }
    return {
      ...current,
      cumulative: result.newCumulative,
      highestVoucherExpiresAt: result.newExpiresAt,
      highestVoucherSignature: result.newSignature,
      lastActivityAt: Date.now(),
      spentAmount: current.spentAmount + args.price
    };
  });
  args.lifecycle?.touch(channelId, finalState.idleTimeoutSeconds);
  return sessionReceipt(finalState, {
    challengeId: args.challengeId,
    externalId: args.externalId
  });
}
async function handleTopUp(args) {
  const additionalAmount = parseU64String2(args.payload.additionalAmount, "additionalAmount");
  if (additionalAmount === 0n)
    throw new Error("additionalAmount must be positive");
  const existing = await args.store.getChannel(args.payload.channelId);
  if (!existing)
    throw new Error(`Channel ${args.payload.channelId} not found`);
  const topUpSignature = transactionSignatureFromWire(args.payload.transaction);
  if (existing.processedTopUpSignatures?.includes(topUpSignature)) {
    return sessionReceipt(existing, {
      challengeId: args.challengeId,
      externalId: args.externalId
    });
  }
  if (existing.sealed)
    throw new Error("Channel is already sealed");
  if (existing.closeRequestedAt !== void 0) {
    throw new Error("Channel close is pending \u2014 no further top-ups accepted");
  }
  await submitTopUpTx({
    additionalAmount,
    channelId: args.payload.channelId,
    channelProgram: args.channelProgram,
    currentDeposit: existing.deposit,
    payer: existing.payer,
    rpc: args.rpc,
    transaction: args.payload.transaction
  });
  const result = await args.store.updateChannel(args.payload.channelId, (current) => {
    if (!current)
      throw new Error(`Channel ${args.payload.channelId} not found`);
    if (current.processedTopUpSignatures?.includes(topUpSignature))
      return current;
    if (current.sealed)
      throw new Error("Channel is already sealed");
    if (current.closeRequestedAt !== void 0) {
      throw new Error("Channel close is pending \u2014 no further top-ups accepted");
    }
    return {
      ...current,
      deposit: current.deposit + additionalAmount,
      lastActivityAt: Date.now(),
      processedTopUpSignatures: [...current.processedTopUpSignatures ?? [], topUpSignature]
    };
  });
  args.lifecycle?.touch(result.channelId, result.idleTimeoutSeconds);
  return sessionReceipt(result, {
    challengeId: args.challengeId,
    externalId: args.externalId
  });
}
async function handleClose(args) {
  const channelId = args.payload.channelId;
  if (args.payload.voucher && args.payload.voucher.voucher.channelId !== channelId) {
    throw new Error(`invalid-voucher: close voucher channelId ${args.payload.voucher.voucher.channelId} does not match the close channelId ${channelId}`);
  }
  const now = BigInt(Math.floor(Date.now() / 1e3));
  await args.store.updateChannel(channelId, async (current) => {
    if (!current)
      throw new Error(`Channel ${channelId} not found`);
    if (current.sealed)
      throw new Error("Channel is already sealed");
    if (args.payload.authentication && current.voucherSigner !== "operator" && !current.openingChallengeId && !current.authentication) {
      throw new Error("session channel predates proof binding; the lifecycle worker will close it");
    }
    if (current.voucherSigner === "operator") {
      if (args.payload.voucher)
        throw new Error("operator-mode close must not include a voucher");
      if (!args.payload.authentication) {
        throw new Error("operator-mode close requires the bound authentication proof");
      }
      if (!current.authentication) {
        throw new Error("session channel predates proof binding; the lifecycle worker will close it");
      }
      if (!sessionAuthenticationMatches(args.payload.authentication, current.authentication)) {
        throw new Error("close authentication does not match the proof bound at open");
      }
      if (!await verifySessionAuthentication(args.payload.authentication, channelId)) {
        throw new Error("invalid close authentication signature");
      }
    } else {
      if (args.payload.authentication)
        throw new Error("client-mode close must not include authentication");
      if (!args.payload.voucher)
        throw new Error("client-mode close requires a voucher");
    }
    if (current.closeRequestedAt !== void 0) {
      if (current.settledSignature === void 0)
        return current;
      throw new Error("Close already requested");
    }
    if (args.payload.voucher) {
      const signed = normalizeSignedVoucher(args.payload.voucher);
      const verdict = await verifyVoucherForChannel({
        deposit: current.deposit,
        settlementWindow: args.settlementWindow,
        signed,
        state: current
      });
      if (verdict.status === "rejected") {
        throw new Error(`${verdict.reason}: ${verdict.detail}`);
      }
      if (verdict.status === "replayed") {
        return { ...current, closeRequestedAt: now };
      }
      if (verdict.status === "accepted") {
        return {
          ...current,
          closeRequestedAt: now,
          cumulative: verdict.newCumulative,
          highestVoucherExpiresAt: verdict.newExpiresAt,
          highestVoucherSignature: verdict.newSignature
        };
      }
    }
    return { ...current, closeRequestedAt: now };
  });
  let onChainSignature;
  if (args.merchantSigner) {
    const closed = await closeAndSettleChannel({
      channelId,
      currency: args.currency,
      decimals: args.decimals,
      merchantSigner: args.merchantSigner,
      mint: args.mint,
      network: args.network,
      programId: args.programId,
      recipient: args.recipient,
      rentPayer: args.rentPayer,
      rpc: args.rpc,
      splits: args.splits,
      store: args.store,
      tokenProgram: args.tokenProgram
    });
    onChainSignature = closed?.signature;
  }
  args.lifecycle?.removeChannel(channelId);
  const finalState = await args.store.getChannel(channelId);
  if (!finalState)
    throw new Error(`Channel ${channelId} not found after close`);
  return sessionReceipt(finalState, {
    challengeId: args.challengeId,
    externalId: args.externalId,
    refunded: finalState.deposit - finalState.cumulative,
    txHash: onChainSignature
  });
}
function sessionReceipt(state, options) {
  if (state.idleTimeoutSeconds === void 0) {
    throw new Error(`Channel ${state.channelId} is missing its negotiated idle timeout`);
  }
  return {
    acceptedCumulative: state.cumulative.toString(),
    ...options.challengeId ? { challengeId: options.challengeId } : {},
    ...options.externalId ? { externalId: options.externalId } : {},
    idleTimeoutSeconds: state.idleTimeoutSeconds,
    intent: "session",
    method: "solana",
    reference: state.channelId,
    ...options.refunded !== void 0 ? { refunded: options.refunded.toString() } : {},
    spent: state.spentAmount.toString(),
    status: "success",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...options.txHash ? { txHash: options.txHash } : {}
  };
}
async function currentClusterSlot(rpc) {
  const getSlot = rpc.getSlot;
  if (!getSlot)
    throw new Error("open freshness validation requires an RPC getSlot method");
  try {
    return await getSlot.call(rpc, { commitment: "confirmed" }).send();
  } catch (error) {
    throw new Error(`failed to fetch current cluster slot for session open: ${String(error)}`);
  }
}
function sessionAuthenticationMatches(left, right) {
  return left.type === right.type && left.challengeId === right.challengeId && left.payer === right.payer && left.signature === right.signature;
}
function optionalSessionAuthenticationMatches(left, right) {
  if (left === void 0 || right === void 0)
    return left === right;
  return sessionAuthenticationMatches(left, right);
}
async function reserveDelivery(store, args) {
  if (args.amount <= 0n)
    throw new Error("amount must be positive");
  let directive;
  await store.updateChannel(args.sessionId, (current) => {
    if (!current)
      throw new Error(`Channel ${args.sessionId} not found`);
    if (current.sealed)
      throw new Error("Channel is already sealed");
    if (current.closeRequestedAt !== void 0) {
      throw new Error("Channel close is pending \u2014 no further deliveries accepted");
    }
    const pendingTotal = current.pendingDeliveries.reduce((sum, p) => sum + p.amount, 0n);
    if (current.cumulative + pendingTotal + args.amount > current.deposit) {
      throw new Error(`Delivery amount ${args.amount} exceeds available deposit`);
    }
    const sequence = current.nextDeliverySequence + 1n;
    const deliveryId = args.deliveryId ?? `${args.sessionId}:${sequence.toString()}`;
    if (current.pendingDeliveries.some((p) => p.deliveryId === deliveryId) || current.committedDeliveries.some((c) => c.deliveryId === deliveryId)) {
      throw new Error(`Delivery ${deliveryId} already exists`);
    }
    const pending = {
      amount: args.amount,
      deliveryId,
      expiresAt: BigInt(args.expiresAt),
      sequence
    };
    directive = {
      amount: args.amount.toString(),
      ...args.commitUrl ? { commitUrl: args.commitUrl } : {},
      currency: args.currency,
      deliveryId,
      expiresAt: args.expiresAt,
      ...args.proof ? { proof: args.proof } : {},
      sequence: Number(sequence),
      sessionId: args.sessionId
    };
    return {
      ...current,
      nextDeliverySequence: sequence,
      pendingDeliveries: [...current.pendingDeliveries, pending]
    };
  });
  if (!directive)
    throw new Error("Delivery reservation did not produce a directive");
  return directive;
}
async function commitDelivery(store, args) {
  const signed = normalizeSignedVoucher(args.voucher);
  const channelId = signed.voucher.channelId;
  const newCumulative = parseU64String2(signed.voucher.cumulativeAmount, "cumulativeAmount");
  const now = BigInt(Math.floor(Date.now() / 1e3));
  let outcome;
  await store.updateChannel(channelId, async (current) => {
    if (!current)
      throw new Error(`Channel ${channelId} not found`);
    if (current.sealed)
      throw new Error("Channel is already sealed");
    if (current.closeRequestedAt !== void 0) {
      throw new Error("Channel close is pending \u2014 no further commits accepted");
    }
    const committed = current.committedDeliveries.find((c) => c.deliveryId === args.deliveryId);
    if (committed) {
      if (committed.cumulative === newCumulative && committed.voucherSignature === signed.signature) {
        await assertVoucherSignature(signed, current.authorizedSigner);
        outcome = { amount: committed.amount, cumulative: committed.cumulative, status: "replayed" };
        return current;
      }
      throw new Error(`Delivery ${args.deliveryId} was already committed with a different voucher`);
    }
    const pendingIdx = current.pendingDeliveries.findIndex((p) => p.deliveryId === args.deliveryId);
    if (pendingIdx < 0)
      throw new Error(`Delivery ${args.deliveryId} not found`);
    const pending = current.pendingDeliveries[pendingIdx];
    if (pending.expiresAt <= now)
      throw new Error(`Delivery ${args.deliveryId} has expired`);
    if (newCumulative <= current.cumulative) {
      throw new Error(`Commit cumulative ${newCumulative} must exceed watermark ${current.cumulative}`);
    }
    const actualAmount = newCumulative - current.cumulative;
    if (actualAmount > pending.amount) {
      throw new Error(`Commit amount ${actualAmount} exceeds reserved amount ${pending.amount}`);
    }
    const verdict = await verifyVoucherForChannel({
      deposit: current.deposit,
      settlementWindow: args.settlementWindow,
      signed,
      state: current
    });
    if (verdict.status === "rejected") {
      throw new Error(`${verdict.reason}: ${verdict.detail}`);
    }
    const nextPending = current.pendingDeliveries.filter((_, i) => i !== pendingIdx);
    const committedDelivery = {
      amount: actualAmount,
      cumulative: newCumulative,
      deliveryId: args.deliveryId,
      voucherSignature: signed.signature
    };
    outcome = { amount: actualAmount, cumulative: newCumulative, status: "committed" };
    return {
      ...current,
      committedDeliveries: [...current.committedDeliveries, committedDelivery],
      cumulative: newCumulative,
      highestVoucherExpiresAt: BigInt(signed.voucher.expiresAt ?? 0),
      highestVoucherSignature: signed.signature,
      lastActivityAt: Date.now(),
      pendingDeliveries: nextPending,
      spentAmount: current.spentAmount + actualAmount
    };
  });
  if (!outcome)
    throw new Error("Commit did not produce a receipt");
  return {
    amount: outcome.amount.toString(),
    cumulative: outcome.cumulative.toString(),
    deliveryId: args.deliveryId,
    sessionId: channelId,
    status: outcome.status
  };
}
async function closeAndSettleChannel(args) {
  const state = await args.store.getChannel(args.channelId);
  if (!state)
    return void 0;
  let voucher;
  if (state.highestVoucherSignature && state.highestVoucherExpiresAt !== void 0 && state.cumulative > 0n) {
    voucher = {
      authorizedSigner: state.authorizedSigner,
      signed: {
        signature: state.highestVoucherSignature,
        signatureType: "ed25519",
        signer: state.authorizedSigner,
        voucher: {
          channelId: args.channelId,
          cumulativeAmount: state.cumulative.toString(),
          expiresAt: Number(state.highestVoucherExpiresAt)
        }
      }
    };
  }
  const result = await submitSettleAndDistribute({
    buildAndSignWireTransaction: (instructions) => buildAndSignWireTransaction(args.rpc, args.merchantSigner, instructions),
    channelId: args.channelId,
    currency: args.currency,
    mint: args.mint,
    network: args.network,
    payee: args.recipient,
    payer: state.payer,
    programId: args.programId,
    rentPayer: state.rentPayer,
    rpc: args.rpc,
    signer: args.merchantSigner,
    splits: args.splits ?? [],
    tokenProgram: args.tokenProgram,
    voucher
  });
  await args.store.updateChannel(args.channelId, (current) => {
    if (!current)
      throw new Error(`Channel ${args.channelId} disappeared during settle`);
    return {
      ...current,
      sealed: true,
      settledOnChain: current.cumulative,
      settledSignature: result.signature
    };
  });
  return result;
}
function rejectIfVoucherRejected(result) {
  if (result.status === "rejected") {
    throw new Error(`${result.reason}: ${result.detail}`);
  }
}
async function assertVoucherSignature(signed, authorizedSigner) {
  if (signed.signatureType !== "ed25519" || signed.signer !== authorizedSigner) {
    throw new Error("invalid-signature: voucher signer does not match the channel");
  }
  let valid = false;
  try {
    valid = await verifyVoucherSignature({
      signatureBase58: signed.signature,
      signerBase58: authorizedSigner,
      voucher: signed.voucher
    });
  } catch (error) {
    throw new Error(`invalid-signature: ${errorMessage2(error)}`);
  }
  if (!valid) {
    throw new Error("invalid-signature: Voucher signature verification failed");
  }
}
function parseU64String2(value, name) {
  if (!/^\d+$/.test(value))
    throw new Error(`${name} is not an unsigned integer string: ${value}`);
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > (1n << 64n) - 1n)
    throw new Error(`${name} outside u64 range`);
  return parsed;
}
function errorMessage2(error) {
  if (error instanceof Error)
    return error.message;
  return String(error);
}
function jsonError(status, message) {
  return Response.json({ error: message }, { status });
}

// ../mpp/dist/server/Subscription.js
import { address as address4, createSolanaRpc, getBase64Codec as getBase64Codec4, getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder3, getTransactionDecoder as getTransactionDecoder4, isTransactionPartialSigner as isTransactionPartialSigner3 } from "@solana/kit";
import { findAssociatedTokenPda as findAssociatedTokenPda3 } from "@solana-program/token";
import { Challenge, Method as Method3, Receipt as Receipt2, Store as Store2 } from "mppx";
import { Transport } from "mppx/server";
function subscription2(parameters) {
  const { planId, mint, decimals, tokenProgram, puller, recipient, periodUnit, periodCount, network = "mainnet-beta", subscriptionProgram = SUBSCRIPTIONS_PROGRAM, signer, store = Store2.memory(), splits, subscriptionExpires } = parameters;
  if (tokenProgram !== TOKEN_PROGRAM && tokenProgram !== TOKEN_2022_PROGRAM) {
    throw new Error(`tokenProgram must be ${TOKEN_PROGRAM} or ${TOKEN_2022_PROGRAM}`);
  }
  if (signer && !isTransactionPartialSigner3(signer)) {
    throw new Error("signer must implement signTransactions() for fee payer mode");
  }
  mapSubscriptionPeriodToHours(periodUnit, periodCount);
  if (subscriptionExpires) {
    const subscriptionExpiryMs = Date.parse(subscriptionExpires);
    if (!Number.isFinite(subscriptionExpiryMs)) {
      throw new Error("subscriptionExpires must be an RFC3339 timestamp");
    }
    if (subscriptionExpiryMs <= Date.now()) {
      throw new Error("subscriptionExpires must be in the future");
    }
  }
  const rpcUrl = parameters.rpcUrl ?? DEFAULT_RPC_URLS[network] ?? DEFAULT_RPC_URLS["mainnet-beta"];
  const pendingAccessProofs = /* @__PURE__ */ new WeakMap();
  const httpTransport = Transport.http();
  const subscriptionTransport = Transport.from({
    ...httpTransport,
    getCredential(input) {
      const credential = httpTransport.getCredential(input);
      if (credential?.payload && credential.payload.type === "proof") {
        pendingAccessProofs.set(input, { credential });
        return null;
      }
      return credential;
    }
  });
  const method = Method3.toServer(subscription, {
    async authorize({ challenge, input }) {
      const pending = pendingAccessProofs.get(input);
      if (!pending)
        return void 0;
      pendingAccessProofs.delete(input);
      const { credential, secretKey } = pending;
      if (!secretKey || !Challenge.verify(credential.challenge, { secretKey })) {
        throw new Error("Subscription proof challenge was not issued by this server");
      }
      assertAccessChallengeMatchesRoute(credential.challenge, challenge);
      const payload = subscription.schema.credential.payload.parse(credential.payload);
      const boundCredential = { ...credential, payload };
      const boundRequest = credential.challenge.request;
      return {
        receipt: await verifySubscriptionAccess(boundCredential, boundRequest, rpcUrl, store)
      };
    },
    defaults: {
      amount: "0",
      currency: mint,
      methodDetails: {
        decimals,
        mint,
        planAddress: planId,
        puller,
        subscriptionProgram,
        tokenProgram
      },
      periodCount: String(periodCount),
      periodUnit,
      recipient
    },
    preflight({ input, secretKey }) {
      const pending = pendingAccessProofs.get(input);
      if (pending)
        pending.secretKey = secretKey;
      return void 0;
    },
    async request({ credential, request }) {
      let recentBlockhash;
      if (!credential) {
        try {
          const res = await fetch(rpcUrl, {
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "getLatestBlockhash",
              params: [{ commitment: "confirmed" }]
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST"
          });
          const data = await res.json();
          recentBlockhash = data.result?.value?.blockhash;
        } catch {
        }
      }
      return {
        ...request,
        amount: request.amount,
        currency: mint,
        methodDetails: {
          decimals,
          mint,
          network,
          planAddress: planId,
          puller,
          subscriptionProgram,
          tokenProgram,
          ...signer ? { feePayer: true, feePayerKey: signer.address } : {},
          ...splits?.length ? { splits } : {},
          ...recentBlockhash ? { recentBlockhash } : {}
        },
        periodCount: request.periodCount ?? String(periodCount),
        periodUnit: request.periodUnit ?? periodUnit,
        recipient,
        ...subscriptionExpires ? { subscriptionExpires } : {}
      };
    },
    stableBinding: subscriptionStableBinding,
    // Durable proofs authorize access rather than activate a payment. The
    // HTTP transport hides them from mppx's activation credential path so
    // its five-minute challenge expiry does not terminate a paid term.
    transport: subscriptionTransport,
    async verify({ credential }) {
      const cred = credential;
      const challenge = cred.challenge.request;
      const payloadType = resolvePayloadType2(cred.payload);
      if (payloadType === "proof") {
        return await verifySubscriptionAccess(cred, challenge, rpcUrl, store);
      }
      assertActivationChallengeNotExpired(cred.challenge.expires);
      assertSubscriptionNotExpired(challenge.subscriptionExpires);
      if (payloadType === "signature" && challenge.methodDetails.feePayer) {
        throw new Error('type="signature" credentials cannot be used with fee sponsorship (feePayer: true)');
      }
      const settlement = await settleActivation(cred, challenge, rpcUrl, store, signer, payloadType);
      const subscriberAddress = settlement.subscriberAddress;
      const subscriptionPda = await deriveSubscriptionPda({
        planPda: address4(challenge.methodDetails.planAddress),
        programId: address4(challenge.methodDetails.subscriptionProgram),
        subscriber: address4(subscriberAddress)
      });
      const expectedPeriodHours = mapSubscriptionPeriodToHours(challenge.periodUnit, Number(challenge.periodCount));
      const delegation = await fetchSubscriptionDelegation(rpcUrl, subscriptionPda, address4(challenge.methodDetails.subscriptionProgram));
      if (!delegation) {
        throw new Error("SubscriptionDelegation account not found after activation");
      }
      if (delegation.planPda !== challenge.methodDetails.planAddress) {
        throw new Error(`SubscriptionDelegation plan mismatch: expected ${challenge.methodDetails.planAddress}, got ${delegation.planPda}`);
      }
      if (delegation.subscriber !== subscriberAddress) {
        throw new Error(`SubscriptionDelegation subscriber mismatch: expected ${subscriberAddress}, got ${delegation.subscriber}`);
      }
      if (delegation.amountPerPeriod !== challenge.amount) {
        throw new Error(`SubscriptionDelegation amount mismatch: expected ${challenge.amount}, got ${delegation.amountPerPeriod}`);
      }
      if (delegation.periodHours !== expectedPeriodHours) {
        throw new Error(`SubscriptionDelegation period mismatch: expected ${expectedPeriodHours}h, got ${delegation.periodHours}h`);
      }
      if (delegation.amountPulledInPeriod !== challenge.amount) {
        throw new Error("Activation transaction did not execute the first-period charge");
      }
      if (settlement.replay) {
        await confirmReplayKey(store, settlement.replay.key, settlement.replay.binding);
      }
      const authentication = requireSubscriptionAuthentication(cred.payload);
      const bindingKey = subscriptionBindingKey(subscriptionPda.toString());
      const subscriptionId = await deriveSubscriptionId(subscriptionPda.toString(), authentication.challengeId);
      const binding = {
        activationSignature: settlement.activationSignature,
        authentication,
        challengeId: authentication.challengeId,
        periodStartTs: delegation.currentPeriodStartTs,
        subscriptionExpires: challenge.subscriptionExpires,
        subscriptionId
      };
      await store.put(bindingKey, binding);
      const periodLengthSeconds = expectedPeriodHours * 3600;
      const periodStartTs = delegation.currentPeriodStartTs;
      const periodEndTs = periodStartTs + periodLengthSeconds;
      return Receipt2.from({
        method: "solana",
        ...cred.challenge.id ? { challengeId: cred.challenge.id } : {},
        ...challenge.externalId ? { externalId: challenge.externalId } : {},
        // Subscription-specific receipt extensions live alongside the
        // Receipt's standard fields. The mppx framework treats unknown
        // fields as opaque metadata.
        expiresAt: challenge.subscriptionExpires,
        periodEnd: new Date(periodEndTs * 1e3).toISOString(),
        periodIndex: 0,
        periodStart: new Date(periodStartTs * 1e3).toISOString(),
        reference: settlement.activationSignature,
        status: "success",
        subscriptionDelegation: subscriptionPda.toString(),
        subscriptionId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  return method;
}
function assertActivationChallengeNotExpired(expires) {
  if (expires === void 0)
    return;
  const expiresAt = Date.parse(expires);
  if (Number.isNaN(expiresAt))
    throw new Error("challenge expires must be an RFC3339 timestamp");
  if (expiresAt <= Date.now())
    throw new Error(`challenge expired at ${expires}`);
}
function assertSubscriptionNotExpired(expires) {
  if (expires === void 0)
    return;
  const expiresAt = Date.parse(expires);
  if (Number.isNaN(expiresAt))
    throw new Error("subscriptionExpires must be an RFC3339 timestamp");
  if (expiresAt <= Date.now())
    throw new Error(`subscription expired at ${expires}`);
}
function assertAccessChallengeMatchesRoute(issued, current) {
  if (issued.method !== current.method || issued.intent !== current.intent || issued.realm !== current.realm || issued.opaque !== current.opaque || JSON.stringify(subscriptionStableBinding(issued.request)) !== JSON.stringify(subscriptionStableBinding(current.request))) {
    throw new Error("Subscription proof challenge does not match this route");
  }
}
function subscriptionStableBinding(request) {
  const methodDetails = { ...request.methodDetails };
  delete methodDetails.recentBlockhash;
  return {
    amount: request.amount,
    currency: request.currency,
    methodDetails,
    periodCount: request.periodCount,
    periodUnit: request.periodUnit,
    recipient: request.recipient,
    subscriptionExpires: request.subscriptionExpires
  };
}
function resolvePayloadType2(payload) {
  if (payload.type === "proof")
    return "proof";
  if (payload.type === "signature")
    return "signature";
  if (payload.type === "transaction")
    return "transaction";
  throw new Error('Missing or invalid payload type: must be "transaction", "signature", or "proof"');
}
async function settleActivation(credential, challenge, rpcUrl, store, signer, payloadType) {
  if (payloadType === "transaction") {
    const { transaction: clientTxBase64 } = credential.payload;
    if (!clientTxBase64) {
      throw new Error("Missing transaction data in credential payload");
    }
    const subscriber2 = extractSubscriberFromTransaction(clientTxBase64, challenge);
    await verifyActivationAuthentication(credential, challenge, subscriber2);
    await validateActivationInstructions(clientTxBase64, challenge, subscriber2);
    let txToSend = clientTxBase64;
    if (signer) {
      if (challenge.methodDetails.feePayerKey !== signer.address) {
        throw new Error("Configured fee-payer signer does not match challenge feePayerKey");
      }
      txToSend = await coSignBase64Transaction(signer, clientTxBase64);
    }
    const signature2 = transactionSignatureFromBase64(txToSend);
    const key = `solana-subscription:consumed:${signature2}`;
    const binding = JSON.stringify({ challengeId: credential.challenge.id ?? null, request: challenge });
    const replayStatus = await inspectReplayKey(store, key, binding);
    if (replayStatus === "conflict") {
      throw new Error("Activation signature already consumed");
    }
    if (replayStatus === "pending") {
      throw new Error("Activation settlement is already in progress; retry shortly");
    }
    let needsConfirmation = replayStatus !== "retry";
    if (replayStatus === "expired") {
      const recoveryClaim = await claimReplayKey(store, key, binding);
      if (recoveryClaim === "conflict")
        throw new Error("Activation signature already consumed");
      if (recoveryClaim === "pending") {
        throw new Error("Activation settlement is already in progress; retry shortly");
      }
      needsConfirmation = recoveryClaim !== "retry";
    } else if (replayStatus === "available") {
      const replayClaim = await claimReplayKey(store, key, binding);
      if (replayClaim === "conflict")
        throw new Error("Activation signature already consumed");
      if (replayClaim === "pending") {
        throw new Error("Activation settlement is already in progress; retry shortly");
      }
      needsConfirmation = replayClaim !== "retry";
      if (replayClaim === "reserved") {
        try {
          await simulateTransaction2(rpcUrl, txToSend);
        } catch (error) {
          await store.delete(key);
          throw error;
        }
        await broadcastTransaction2(rpcUrl, txToSend);
      }
    }
    if (needsConfirmation) {
      await waitForConfirmation2(rpcUrl, signature2);
    }
    return { activationSignature: signature2, replay: { binding, key }, subscriberAddress: subscriber2 };
  }
  const { signature } = credential.payload;
  if (!signature) {
    throw new Error("Missing signature in credential payload");
  }
  const consumedKey = `solana-subscription:consumed:${signature}`;
  if (await store.get(consumedKey) !== null) {
    throw new Error("Activation signature already consumed");
  }
  const tx = await fetchTransactionRaw(rpcUrl, signature);
  if (!tx)
    throw new Error("Transaction not found or not yet confirmed");
  assertReportedTransactionVersion(tx.version);
  if (tx.meta?.err)
    throw new Error("Transaction failed on-chain");
  const [transactionBase64] = tx.transaction;
  const subscriber = extractSubscriberFromTransaction(transactionBase64, challenge);
  await verifyActivationAuthentication(credential, challenge, subscriber);
  await validateActivationInstructions(transactionBase64, challenge, subscriber);
  if (!await reserveReplayKey(store, consumedKey)) {
    throw new Error("Activation signature already consumed");
  }
  return { activationSignature: signature, subscriberAddress: subscriber };
}
async function verifyActivationAuthentication(credential, challenge, subscriber) {
  const authentication = requireSubscriptionAuthentication(credential.payload);
  if (!credential.challenge.id || authentication.challengeId !== credential.challenge.id) {
    throw new Error("Subscription proof challengeId does not match the activation challenge");
  }
  if (authentication.payer !== subscriber) {
    throw new Error("Subscription proof payer does not match the activation subscriber");
  }
  const subscriptionDelegation = await deriveSubscriptionPda({
    planPda: address4(challenge.methodDetails.planAddress),
    programId: address4(challenge.methodDetails.subscriptionProgram),
    subscriber: address4(subscriber)
  });
  if (!await verifySubscriptionAuthentication(authentication, subscriptionDelegation.toString())) {
    throw new Error("Invalid subscription authentication proof");
  }
}
async function verifySubscriptionAccess(credential, challenge, rpcUrl, store) {
  const authentication = requireSubscriptionAuthentication(credential.payload);
  const subscriptionDelegation = credential.payload.subscriptionDelegation;
  if (!subscriptionDelegation)
    throw new Error("Subscription proof payload is missing subscriptionDelegation");
  if (!credential.challenge.id || authentication.challengeId !== credential.challenge.id) {
    throw new Error("Subscription proof challengeId does not match the activation challenge");
  }
  const programId = challenge.methodDetails.subscriptionProgram;
  const expectedDelegation = await deriveSubscriptionPda({
    planPda: address4(challenge.methodDetails.planAddress),
    programId: address4(programId),
    subscriber: address4(authentication.payer)
  });
  if (subscriptionDelegation !== expectedDelegation.toString()) {
    throw new Error("Subscription proof delegation does not match the plan and payer");
  }
  if (!await verifySubscriptionAuthentication(authentication, subscriptionDelegation)) {
    throw new Error("Invalid subscription authentication proof");
  }
  const stored = await store.get(subscriptionBindingKey(subscriptionDelegation));
  const binding = parseSubscriptionBinding(stored);
  if (binding.challengeId !== credential.challenge.id || JSON.stringify(binding.authentication) !== JSON.stringify(authentication)) {
    throw new Error("Subscription proof does not match the activation binding");
  }
  const delegation = await fetchSubscriptionDelegation(rpcUrl, expectedDelegation, address4(programId));
  if (!delegation)
    throw new Error("SubscriptionDelegation account not found");
  if (delegation.planPda !== challenge.methodDetails.planAddress || delegation.subscriber !== authentication.payer) {
    throw new Error("SubscriptionDelegation does not match the bound plan and payer");
  }
  const authorityPda = await deriveSubscriptionAuthorityPda({
    mint: address4(challenge.methodDetails.mint),
    programId: address4(programId),
    subscriber: address4(authentication.payer)
  });
  const authorityInitId = await fetchSubscriptionAuthorityInitId(rpcUrl, authorityPda, address4(programId));
  if (authorityInitId !== delegation.authorityInitId) {
    throw new Error("Subscription authority has been invalidated");
  }
  const expectedPeriodHours = mapSubscriptionPeriodToHours(challenge.periodUnit, Number(challenge.periodCount));
  if (delegation.amountPerPeriod !== challenge.amount || delegation.periodHours !== expectedPeriodHours || delegation.amountPulledInPeriod !== challenge.amount) {
    throw new Error("Subscription is not paid for the current billing period");
  }
  const now = Math.floor(Date.now() / 1e3);
  const periodLengthSeconds = expectedPeriodHours * 3600;
  const periodEndTs = delegation.currentPeriodStartTs + periodLengthSeconds;
  if (now < delegation.currentPeriodStartTs || now >= periodEndTs) {
    throw new Error("Subscription is not paid for the current billing period");
  }
  if (delegation.expiresAtTs !== 0 && now >= delegation.expiresAtTs) {
    throw new Error("Subscription cancellation has taken effect");
  }
  if (binding.subscriptionExpires && Date.parse(binding.subscriptionExpires) <= Date.now()) {
    throw new Error("Subscription has expired");
  }
  const elapsed = delegation.currentPeriodStartTs - binding.periodStartTs;
  if (elapsed < 0 || elapsed % periodLengthSeconds !== 0) {
    throw new Error("Subscription billing anchor does not align with the current period");
  }
  const periodIndex = elapsed / periodLengthSeconds;
  return Receipt2.from({
    challengeId: credential.challenge.id,
    expiresAt: binding.subscriptionExpires,
    method: "solana",
    periodEnd: new Date(periodEndTs * 1e3).toISOString(),
    periodIndex,
    periodStart: new Date(delegation.currentPeriodStartTs * 1e3).toISOString(),
    reference: binding.activationSignature,
    status: "success",
    subscriptionDelegation,
    subscriptionId: binding.subscriptionId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
function requireSubscriptionAuthentication(payload) {
  const authentication = payload.authentication;
  if (!authentication || authentication.type !== "proof") {
    throw new Error('Subscription credential is missing authentication.type="proof"');
  }
  return authentication;
}
function subscriptionBindingKey(subscriptionDelegation) {
  return `solana-subscription:authentication:${subscriptionDelegation}`;
}
async function deriveSubscriptionId(subscriptionDelegation, challengeId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mpp-subscription-id-v1:${challengeId}:${subscriptionDelegation}`));
  return base64UrlEncodeNoPadding(new Uint8Array(digest).slice(0, 18));
}
function parseSubscriptionBinding(value) {
  if (!value || typeof value !== "object")
    throw new Error("Subscription has no bound authentication proof");
  const binding = value;
  if (!binding.authentication || typeof binding.activationSignature !== "string" || typeof binding.challengeId !== "string" || typeof binding.periodStartTs !== "number" || typeof binding.subscriptionId !== "string") {
    throw new Error("Subscription authentication binding is malformed");
  }
  return binding;
}
function decodeCompiledMessage(clientTxBase64) {
  let message;
  try {
    const txBytes = getBase64Codec4().encode(clientTxBase64);
    const decoded = getTransactionDecoder4().decode(txBytes);
    const compiled = getCompiledTransactionMessageDecoder3().decode(decoded.messageBytes);
    message = { ...compiled, signerAccounts: Object.keys(decoded.signatures) };
  } catch (e) {
    throw new Error(`Invalid transaction: ${e instanceof Error ? e.message : String(e)}`);
  }
  assertVersionedTransactionMessage(message);
  return message;
}
function extractSubscriberFromTransaction(clientTxBase64, challenge) {
  const message = decodeCompiledMessage(clientTxBase64);
  if (message.staticAccounts.length === 0) {
    throw new Error("Transaction has no static accounts");
  }
  const firstAccount = message.staticAccounts[0];
  if (challenge.methodDetails.feePayer && challenge.methodDetails.feePayerKey) {
    if (firstAccount !== challenge.methodDetails.feePayerKey) {
      throw new Error(`Transaction fee payer must be ${challenge.methodDetails.feePayerKey}`);
    }
    for (const account of message.signerAccounts.slice(1)) {
      if (account !== challenge.methodDetails.puller)
        return account;
    }
    throw new Error("Could not identify subscriber among transaction signers");
  }
  if (challenge.methodDetails.puller && firstAccount === challenge.methodDetails.puller) {
    throw new Error("Subscriber cannot be the server puller");
  }
  return firstAccount;
}
async function validateActivationInstructions(clientTxBase64, challenge, subscriber) {
  const message = decodeCompiledMessage(clientTxBase64);
  if (message.addressTableLookups?.length) {
    throw new Error("v0 transactions with address lookup tables are not supported in activation flow");
  }
  const programId = challenge.methodDetails.subscriptionProgram;
  let sawSubscribe = false;
  let sawTransferSubscription = false;
  let subscribeIndex = -1;
  let transferIndex = -1;
  let sawInitializeAuthority = false;
  let sawMemo = false;
  let sawComputeUnitLimit = false;
  let sawComputeUnitPrice = false;
  for (const [index, ix] of message.instructions.entries()) {
    const program = message.staticAccounts[ix.programAddressIndex];
    if (program === COMPUTE_BUDGET_PROGRAM) {
      if (ix.data[0] === 2 && ix.data.length === 5) {
        if (sawComputeUnitLimit)
          throw new Error("Multiple compute-unit-limit instructions found");
        sawComputeUnitLimit = true;
        if (readU32Le2(ix.data, 1) > 4e5)
          throw new Error("Activation compute unit limit exceeds 400000");
        continue;
      }
      if (ix.data[0] === 3 && ix.data.length === 9) {
        if (sawComputeUnitPrice)
          throw new Error("Multiple compute-unit-price instructions found");
        sawComputeUnitPrice = true;
        const maxPrice = challenge.methodDetails.feePayer ? 10000n : 5000000n;
        if (readU64Le2(ix.data, 1) > maxPrice)
          throw new Error("Activation compute unit price exceeds cap");
        continue;
      }
      throw new Error("Unsupported compute-budget instruction in activation transaction");
    }
    if (program === MEMO_PROGRAM) {
      if (sawMemo)
        throw new Error("Multiple memo instructions found");
      sawMemo = true;
      const expectedMemo = challenge.externalId;
      if (!expectedMemo || new TextDecoder().decode(ix.data) !== expectedMemo) {
        throw new Error("Activation memo does not match challenge externalId");
      }
      continue;
    }
    if (program === ASSOCIATED_TOKEN_PROGRAM) {
      if (ix.data.length !== 1 || ix.data[0] !== 1) {
        throw new Error("Only idempotent ATA creation is allowed in activation transaction");
      }
      if (!subscriber || ix.accountIndices.length !== 6) {
        throw new Error("Invalid ATA creation instruction in activation transaction");
      }
      const account = (position) => message.staticAccounts[ix.accountIndices[position]];
      const ataOwner = account(2);
      if (ataOwner !== subscriber && ataOwner !== challenge.recipient) {
        throw new Error("ATA creation owner does not match the activation subscriber or recipient");
      }
      const [expectedAta] = await findAssociatedTokenPda3({
        mint: address4(challenge.methodDetails.mint),
        owner: address4(ataOwner),
        tokenProgram: address4(challenge.methodDetails.tokenProgram)
      });
      if (account(1) !== expectedAta || account(3) !== challenge.methodDetails.mint || account(4) !== SYSTEM_PROGRAM || account(5) !== challenge.methodDetails.tokenProgram) {
        throw new Error("ATA creation does not match the activation subscriber and mint");
      }
      continue;
    }
    if (program !== programId) {
      throw new Error(`Unsupported program ${program ?? "<invalid>"} in activation transaction`);
    }
    if (ix.data.length === 0)
      throw new Error("Empty subscriptions-program instruction");
    if (ix.data[0] === SUBSCRIPTIONS_INIT_AUTHORITY_DISCRIMINATOR) {
      if (sawInitializeAuthority)
        throw new Error("Multiple initialize_subscription_authority instructions found");
      sawInitializeAuthority = true;
    } else if (ix.data[0] === SUBSCRIPTIONS_SUBSCRIBE_DISCRIMINATOR) {
      if (sawSubscribe)
        throw new Error("Multiple subscribe instructions found");
      sawSubscribe = true;
      subscribeIndex = index;
    } else if (ix.data[0] === SUBSCRIPTIONS_TRANSFER_DISCRIMINATOR) {
      if (sawTransferSubscription)
        throw new Error("Multiple transfer_subscription instructions found");
      if (!subscriber)
        throw new Error("Cannot validate transfer_subscription without subscriber");
      const expectedRecipientAta = (await findAssociatedTokenPda3({
        mint: address4(challenge.methodDetails.mint),
        owner: address4(challenge.recipient),
        tokenProgram: address4(challenge.methodDetails.tokenProgram)
      }))[0];
      const receiverPosition = ix.accountIndices.length === 10 ? 4 : ix.accountIndices.length === 9 ? 6 : -1;
      if (receiverPosition < 0 || message.staticAccounts[ix.accountIndices[receiverPosition]] !== expectedRecipientAta) {
        throw new Error("transfer_subscription receiver does not match the challenge recipient");
      }
      if (ix.data.length === 73) {
        if (readU64Le2(ix.data, 1) !== BigInt(challenge.amount)) {
          throw new Error("transfer_subscription amount does not match the challenge");
        }
        if (encodeBase58(ix.data.slice(9, 41)) !== subscriber) {
          throw new Error("transfer_subscription delegator does not match subscriber");
        }
        if (encodeBase58(ix.data.slice(41, 73)) !== challenge.methodDetails.mint) {
          throw new Error("transfer_subscription mint does not match the challenge");
        }
      } else if (ix.data.length !== 1) {
        throw new Error("Invalid transfer_subscription instruction data");
      }
      sawTransferSubscription = true;
      transferIndex = index;
    } else {
      throw new Error(`Unsupported subscriptions instruction ${ix.data[0]} in activation transaction`);
    }
  }
  if (!sawSubscribe)
    throw new Error("Activation transaction is missing subscribe instruction");
  if (!sawTransferSubscription)
    throw new Error("Activation transaction is missing transfer_subscription instruction");
  if (transferIndex < subscribeIndex) {
    throw new Error("subscribe must precede transfer_subscription in activation transaction");
  }
  if (challenge.externalId && !sawMemo) {
    throw new Error("Activation transaction is missing challenge externalId memo");
  }
}
async function fetchSubscriptionDelegation(rpcUrl, subscriptionPda, expectedOwner) {
  const rpc = createSolanaRpc(rpcUrl);
  const account = await rpc.getAccountInfo(address4(subscriptionPda.toString()), { encoding: "base64" }).send();
  if (!account.value)
    return null;
  if (expectedOwner && account.value.owner !== expectedOwner) {
    throw new Error(`SubscriptionDelegation owner mismatch: expected ${expectedOwner}, got ${account.value.owner}`);
  }
  const [b64] = account.value.data;
  const data = new Uint8Array(getBase64Codec4().encode(b64));
  return decodeSubscriptionDelegation(data);
}
async function fetchSubscriptionAuthorityInitId(rpcUrl, authorityPda, expectedOwner) {
  const rpc = createSolanaRpc(rpcUrl);
  const account = await rpc.getAccountInfo(address4(authorityPda.toString()), { encoding: "base64" }).send();
  if (!account.value)
    throw new Error("SubscriptionAuthority account not found");
  if (account.value.owner !== expectedOwner) {
    throw new Error(`SubscriptionAuthority owner mismatch: expected ${expectedOwner}, got ${account.value.owner}`);
  }
  const [b64] = account.value.data;
  const data = new Uint8Array(getBase64Codec4().encode(b64));
  return getSubscriptionAuthorityDecoder().decode(data).initId;
}
function decodeSubscriptionDelegation(data) {
  if (data.length !== SUBSCRIPTION_SIZE) {
    throw new Error(`Unexpected SubscriptionDelegation account length: ${data.length} bytes (expected ${SUBSCRIPTION_SIZE})`);
  }
  const decoded = getSubscriptionDelegationDecoder().decode(data);
  return {
    amountPerPeriod: decoded.terms.amount.toString(),
    amountPulledInPeriod: decoded.amountPulledInPeriod.toString(),
    authorityInitId: decoded.header.initId,
    currentPeriodStartTs: Number(decoded.currentPeriodStartTs),
    expiresAtTs: Number(decoded.expiresAtTs),
    periodHours: Number(decoded.terms.periodHours),
    planPda: decoded.header.delegatee,
    subscriber: decoded.header.delegator
  };
}
function readU64Le2(data, offset) {
  let value = 0n;
  for (let i = 0; i < 8; i += 1) {
    value |= BigInt(data[offset + i]) << BigInt(i * 8);
  }
  return value;
}
function readU32Le2(data, offset) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}
var BASE58_ALPHABET2 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encodeBase58(bytes) {
  if (bytes.length === 0)
    return "";
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0)
    leading += 1;
  const buf = [];
  for (let i = leading; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < buf.length; j += 1) {
      const x = (buf[j] << 8) + carry;
      buf[j] = x % 58;
      carry = Math.floor(x / 58);
    }
    while (carry > 0) {
      buf.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = "";
  for (let i = 0; i < leading; i += 1)
    out += "1";
  for (let i = buf.length - 1; i >= 0; i -= 1)
    out += BASE58_ALPHABET2[buf[i]];
  return out;
}
function base64UrlEncodeNoPadding(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1)
    s += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa !== "undefined" ? btoa(s) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function fetchTransactionRaw(rpcUrl, signature) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "getTransaction",
      params: [signature, { commitment: "confirmed", encoding: "base64", maxSupportedTransactionVersion: 1 }]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  return data.result ?? null;
}
async function simulateTransaction2(rpcUrl, base64Tx) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "simulateTransaction",
      params: [base64Tx, { commitment: "confirmed", encoding: "base64" }]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  const simErr = data.result?.value?.err;
  if (simErr) {
    const logs = data.result?.value?.logs ?? [];
    console.error("[solana-mpp] Subscription simulation failed:", JSON.stringify(simErr));
    for (const log of logs)
      console.error("[solana-mpp]", log);
    throw new Error(`Activation simulation failed: ${JSON.stringify(simErr)}`);
  }
}
async function broadcastTransaction2(rpcUrl, base64Tx) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "sendTransaction",
      params: [base64Tx, { encoding: "base64", skipPreflight: false }]
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  const data = await response.json();
  if (data.error)
    throw new Error(`RPC error: ${data.error.message}`);
  if (!data.result)
    throw new Error("No signature returned from sendTransaction");
  return data.result;
}
async function waitForConfirmation2(rpcUrl, signature, timeoutMs = 3e4) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = await fetch(rpcUrl, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "getSignatureStatuses",
        params: [[signature]]
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const data = await response.json();
    const status = data.result?.value?.[0];
    if (status) {
      if (status.err)
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")
        return;
    }
    await new Promise((r) => setTimeout(r, 2e3));
  }
  throw new Error("Transaction confirmation timeout");
}

// ../mpp/dist/server/Methods.js
var solana = Object.assign((parameters) => solana.charge(parameters), {
  charge: charge2,
  session: session2,
  subscription: subscription2
});

// ../mpp/dist/server/index.js
import { Mppx, Expires, Store as Store3 } from "mppx/server";

// ../../node_modules/.pnpm/@x402+core@file+.x402-vendor+x402-core-2.23.0.tgz/node_modules/@x402/core/dist/esm/facilitator/index.mjs
var x402Facilitator = class {
  constructor() {
    this.registeredFacilitatorSchemes = /* @__PURE__ */ new Map();
    this.extensions = /* @__PURE__ */ new Map();
    this.beforeVerifyHooks = [];
    this.afterVerifyHooks = [];
    this.onVerifyFailureHooks = [];
    this.beforeSettleHooks = [];
    this.afterSettleHooks = [];
    this.onSettleFailureHooks = [];
  }
  /**
   * Registers a scheme facilitator for the current x402 version.
   * Networks are stored and used for getSupported() - no need to specify them later.
   *
   * @param networks - Single network or array of networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  register(networks, facilitator) {
    const networksArray = Array.isArray(networks) ? networks : [networks];
    return this._registerScheme(x402Version, networksArray, facilitator);
  }
  /**
   * Registers a scheme facilitator for x402 version 1.
   * Networks are stored and used for getSupported() - no need to specify them later.
   *
   * @param networks - Single network or array of networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  registerV1(networks, facilitator) {
    const networksArray = Array.isArray(networks) ? networks : [networks];
    return this._registerScheme(1, networksArray, facilitator);
  }
  /**
   * Registers a protocol extension.
   *
   * @param extension - The extension object to register
   * @returns The x402Facilitator instance for chaining
   */
  registerExtension(extension) {
    this.extensions.set(extension.key, extension);
    return this;
  }
  /**
   * Gets the list of registered extension keys.
   *
   * @returns Array of extension key strings
   */
  getExtensions() {
    return Array.from(this.extensions.keys());
  }
  /**
   * Gets a registered extension by key.
   *
   * @param key - The extension key to look up
   * @returns The extension object, or undefined if not registered
   */
  getExtension(key) {
    return this.extensions.get(key);
  }
  /**
   * Register a hook to execute before facilitator payment verification.
   * Can abort verification by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onBeforeVerify(hook) {
    this.beforeVerifyHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after successful facilitator payment verification (isValid: true).
   * This hook is NOT called when verification fails (isValid: false) - use onVerifyFailure for that.
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onAfterVerify(hook) {
    this.afterVerifyHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute when facilitator payment verification fails.
   * Called when: verification returns isValid: false, or an exception is thrown during verification.
   * Can recover from failure by returning { recovered: true, result: VerifyResponse }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onVerifyFailure(hook) {
    this.onVerifyFailureHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute before facilitator payment settlement.
   * Can abort settlement by returning { abort: true, reason: string }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onBeforeSettle(hook) {
    this.beforeSettleHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute after successful facilitator payment settlement.
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onAfterSettle(hook) {
    this.afterSettleHooks.push(hook);
    return this;
  }
  /**
   * Register a hook to execute when facilitator payment settlement fails.
   * Can recover from failure by returning { recovered: true, result: SettleResponse }
   *
   * @param hook - The hook function to register
   * @returns The x402Facilitator instance for chaining
   */
  onSettleFailure(hook) {
    this.onSettleFailureHooks.push(hook);
    return this;
  }
  /**
   * Gets supported payment kinds, extensions, and signers.
   * Uses networks registered during register() calls - no parameters needed.
   * Returns flat array format for backward compatibility with V1 clients.
   *
   * @returns Supported response with kinds as array (with version in each element), extensions, and signers
   */
  getSupported() {
    const kinds = [];
    const signersByFamily = {};
    for (const [version, schemeDataArray] of this.registeredFacilitatorSchemes) {
      for (const schemeData of schemeDataArray) {
        const { facilitator, networks } = schemeData;
        const scheme = facilitator.scheme;
        for (const network of networks) {
          const extra = facilitator.getExtra(network);
          kinds.push({
            x402Version: version,
            scheme,
            network,
            ...extra && { extra }
          });
          const family = facilitator.caipFamily;
          if (!signersByFamily[family]) {
            signersByFamily[family] = /* @__PURE__ */ new Set();
          }
          facilitator.getSigners(network).forEach((signer) => signersByFamily[family].add(signer));
        }
      }
    }
    const signers = {};
    for (const [family, signerSet] of Object.entries(signersByFamily)) {
      signers[family] = Array.from(signerSet);
    }
    return {
      kinds,
      extensions: this.getExtensions(),
      signers
    };
  }
  /**
   * Verifies a payment payload against requirements.
   *
   * @param paymentPayload - The payment payload to verify
   * @param paymentRequirements - The payment requirements to verify against
   * @returns Promise resolving to the verification response
   */
  async verify(paymentPayload, paymentRequirements) {
    const context = {
      paymentPayload,
      requirements: paymentRequirements
    };
    for (const hook of this.beforeVerifyHooks) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        return {
          isValid: false,
          invalidReason: result.reason
        };
      }
    }
    try {
      const schemeDataArray = this.registeredFacilitatorSchemes.get(paymentPayload.x402Version);
      if (!schemeDataArray) {
        throw new Error(
          `No facilitator registered for x402 version: ${paymentPayload.x402Version}`
        );
      }
      let schemeNetworkFacilitator;
      for (const schemeData of schemeDataArray) {
        if (schemeData.facilitator.scheme === paymentRequirements.scheme) {
          if (schemeData.networks.has(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
          if (networkMatchesPattern(schemeData.pattern, paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
        }
      }
      if (!schemeNetworkFacilitator) {
        throw new Error(
          `No facilitator registered for scheme: ${paymentRequirements.scheme} and network: ${paymentRequirements.network}`
        );
      }
      const facilitatorContext = this.buildFacilitatorContext();
      const verifyResult = await schemeNetworkFacilitator.verify(
        paymentPayload,
        paymentRequirements,
        facilitatorContext
      );
      if (!verifyResult.isValid) {
        const reason = verifyResult.invalidReason || "Verification failed";
        const detail = verifyResult.invalidMessage;
        const failureContext = {
          ...context,
          error: new Error(detail ? `${reason}: ${detail}` : reason)
        };
        for (const hook of this.onVerifyFailureHooks) {
          const result = await hook(failureContext);
          if (result && "recovered" in result && result.recovered) {
            const recoveredContext = {
              ...context,
              result: result.result
            };
            for (const hook2 of this.afterVerifyHooks) {
              await hook2(recoveredContext);
            }
            return result.result;
          }
        }
        return verifyResult;
      }
      const resultContext = {
        ...context,
        result: verifyResult
      };
      for (const hook of this.afterVerifyHooks) {
        await hook(resultContext);
      }
      return verifyResult;
    } catch (error) {
      const failureContext = {
        ...context,
        error
      };
      for (const hook of this.onVerifyFailureHooks) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.result;
        }
      }
      throw error;
    }
  }
  /**
   * Settles a payment based on the payload and requirements.
   *
   * @param paymentPayload - The payment payload to settle
   * @param paymentRequirements - The payment requirements for settlement
   * @returns Promise resolving to the settlement response
   */
  async settle(paymentPayload, paymentRequirements) {
    const context = {
      paymentPayload,
      requirements: paymentRequirements
    };
    for (const hook of this.beforeSettleHooks) {
      const result = await hook(context);
      if (result && "abort" in result && result.abort) {
        throw new Error(`Settlement aborted: ${result.reason}`);
      }
    }
    try {
      const schemeDataArray = this.registeredFacilitatorSchemes.get(paymentPayload.x402Version);
      if (!schemeDataArray) {
        throw new Error(
          `No facilitator registered for x402 version: ${paymentPayload.x402Version}`
        );
      }
      let schemeNetworkFacilitator;
      for (const schemeData of schemeDataArray) {
        if (schemeData.facilitator.scheme === paymentRequirements.scheme) {
          if (schemeData.networks.has(paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
          if (networkMatchesPattern(schemeData.pattern, paymentRequirements.network)) {
            schemeNetworkFacilitator = schemeData.facilitator;
            break;
          }
        }
      }
      if (!schemeNetworkFacilitator) {
        throw new Error(
          `No facilitator registered for scheme: ${paymentRequirements.scheme} and network: ${paymentRequirements.network}`
        );
      }
      const facilitatorContext = this.buildFacilitatorContext();
      const settleResult = await schemeNetworkFacilitator.settle(
        paymentPayload,
        paymentRequirements,
        facilitatorContext
      );
      const resultContext = {
        ...context,
        result: settleResult
      };
      for (const hook of this.afterSettleHooks) {
        await hook(resultContext);
      }
      return settleResult;
    } catch (error) {
      const failureContext = {
        ...context,
        error
      };
      for (const hook of this.onSettleFailureHooks) {
        const result = await hook(failureContext);
        if (result && "recovered" in result && result.recovered) {
          return result.result;
        }
      }
      throw error;
    }
  }
  /**
   * Builds a FacilitatorContext from the registered extensions map.
   * Passed to mechanism verify/settle so they can access extension capabilities.
   *
   * @returns A FacilitatorContext backed by this facilitator's registered extensions
   */
  buildFacilitatorContext() {
    const extensionsMap = this.extensions;
    return {
      getExtension(key) {
        return extensionsMap.get(key);
      }
    };
  }
  /**
   * Internal method to register a scheme facilitator.
   *
   * @param x402Version - The x402 protocol version
   * @param networks - Array of concrete networks this facilitator supports
   * @param facilitator - The scheme network facilitator to register
   * @returns The x402Facilitator instance for chaining
   */
  _registerScheme(x402Version2, networks, facilitator) {
    if (!this.registeredFacilitatorSchemes.has(x402Version2)) {
      this.registeredFacilitatorSchemes.set(x402Version2, []);
    }
    const schemeDataArray = this.registeredFacilitatorSchemes.get(x402Version2);
    schemeDataArray.push({
      facilitator,
      networks: new Set(networks),
      pattern: this.derivePattern(networks)
    });
    return this;
  }
  /**
   * Derives a wildcard pattern from an array of networks.
   * If all networks share the same namespace, returns wildcard pattern.
   * Otherwise returns the first network for exact matching.
   *
   * @param networks - Array of networks
   * @returns Derived pattern for matching
   */
  derivePattern(networks) {
    if (networks.length === 0) return "";
    if (networks.length === 1) return networks[0];
    const namespaces = networks.map((n) => n.split(":")[0]);
    const uniqueNamespaces = new Set(namespaces);
    if (uniqueNamespaces.size === 1) {
      return `${namespaces[0]}:*`;
    }
    return networks[0];
  }
};

// ../../node_modules/.pnpm/@x402+svm@file+.x402-vendor+x402-svm-2.23.0.tgz_@solana+kit@6.10.0_bufferutil@4.1.0_fas_4024990b1dd87ed6a149db0849575943/node_modules/@x402/svm/dist/esm/chunk-H3ENUQ7F.mjs
function isUptoSvmPayload(payload) {
  return typeof payload.from === "string" && typeof payload.maxAmount === "string" && typeof payload.deposit === "string" && typeof payload.channelId === "string" && typeof payload.authorizedSigner === "string" && typeof payload.openTransaction === "string" && typeof payload.openSlot === "string" && Number.isSafeInteger(payload.expiresAt) && Number.isSafeInteger(payload.validAfter) && typeof payload.nonce === "string" && (payload.voucherSignature === void 0 || typeof payload.voucherSignature === "string");
}

// ../../node_modules/.pnpm/@x402+svm@file+.x402-vendor+x402-svm-2.23.0.tgz_@solana+kit@6.10.0_bufferutil@4.1.0_fas_4024990b1dd87ed6a149db0849575943/node_modules/@x402/svm/dist/esm/chunk-UP5HPW4M.mjs
import { COMPUTE_BUDGET_PROGRAM_ADDRESS as COMPUTE_BUDGET_PROGRAM_ADDRESS2 } from "@solana-program/compute-budget";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { TOKEN_2022_PROGRAM_ADDRESS, findAssociatedTokenPda as findAssociatedTokenPda4 } from "@solana-program/token-2022";
import {
  decompileTransactionMessage,
  getBase58Encoder as getBase58Encoder2,
  getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder4
} from "@solana/kit";
var DEFAULT_SMART_WALLET_MAX_COMPUTE_UNITS = 4e5;
var DEFAULT_SMART_WALLET_MAX_PRIORITY_FEE_MICROLAMPORTS = 5e4;
var IX_SET_COMPUTE_UNIT_LIMIT = 2;
var IX_SET_COMPUTE_UNIT_PRICE = 3;
var IX_TOKEN_TRANSFER_CHECKED = 12;
var TOKEN_PROGRAMS = /* @__PURE__ */ new Set([
  TOKEN_PROGRAM_ADDRESS.toString(),
  TOKEN_2022_PROGRAM_ADDRESS.toString()
]);
async function assertFeePayerIsolated(transaction, feePayerAddress, signer, network) {
  const compiled = getCompiledTransactionMessageDecoder4().decode(transaction.messageBytes);
  const hasALTs = "addressTableLookups" in compiled && Array.isArray(compiled.addressTableLookups) && compiled.addressTableLookups.length > 0;
  let decompiled;
  if (hasALTs) {
    if (!signer || !network || typeof signer.fetchAddressLookupTables !== "function") {
      throw new Error(
        "smart_wallet_alt_resolution_not_available: transaction uses Address Lookup Tables but signer does not implement fetchAddressLookupTables"
      );
    }
    const altAddresses = compiled.addressTableLookups.map((l) => l.lookupTableAddress.toString());
    const resolved = await signer.fetchAddressLookupTables(altAddresses, network);
    const addressesByLookupTableAddress = {};
    for (const [key, addresses] of Object.entries(resolved)) {
      addressesByLookupTableAddress[key] = addresses.map((a) => a);
    }
    decompiled = decompileTransactionMessage(compiled, { addressesByLookupTableAddress });
  } else {
    decompiled = decompileTransactionMessage(compiled);
  }
  const instructions = decompiled.instructions ?? [];
  for (const ix of instructions) {
    if (ix.programAddress.toString() === feePayerAddress) {
      throw new Error(
        `smart_wallet_fee_payer_not_isolated: fee payer ${feePayerAddress} invoked as program`
      );
    }
    const accounts = ix.accounts ?? [];
    for (const account of accounts) {
      if (account.address.toString() === feePayerAddress) {
        throw new Error(
          `smart_wallet_fee_payer_not_isolated: fee payer ${feePayerAddress} appears in instruction accounts (program: ${ix.programAddress})`
        );
      }
    }
  }
}
function validateComputeBudgetLimits(transaction, limits) {
  const maxCU = limits?.maxComputeUnits ?? DEFAULT_SMART_WALLET_MAX_COMPUTE_UNITS;
  const maxPriorityFee = limits?.maxPriorityFeeMicroLamports ?? DEFAULT_SMART_WALLET_MAX_PRIORITY_FEE_MICROLAMPORTS;
  const compiled = getCompiledTransactionMessageDecoder4().decode(transaction.messageBytes);
  const decompiled = decompileTransactionMessage(compiled);
  const instructions = decompiled.instructions ?? [];
  for (const ix of instructions) {
    if (ix.programAddress.toString() !== COMPUTE_BUDGET_PROGRAM_ADDRESS2.toString()) continue;
    const data = ix.data;
    if (!data || data.length === 0) {
      throw new Error("smart_wallet_malformed_compute_budget: empty instruction data");
    }
    if (data[0] === IX_SET_COMPUTE_UNIT_LIMIT) {
      if (data.length < 5) {
        throw new Error("smart_wallet_malformed_compute_limit");
      }
      const units = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1, true);
      if (units > maxCU) {
        throw new Error(`smart_wallet_compute_units_too_high: ${units} exceeds max ${maxCU}`);
      }
      continue;
    }
    if (data[0] === IX_SET_COMPUTE_UNIT_PRICE) {
      if (data.length < 9) {
        throw new Error("smart_wallet_malformed_compute_price");
      }
      const microLamports = new DataView(
        data.buffer,
        data.byteOffset,
        data.byteLength
      ).getBigUint64(1, true);
      if (microLamports > BigInt(maxPriorityFee)) {
        throw new Error(
          `smart_wallet_priority_fee_too_high: ${microLamports} exceeds max ${maxPriorityFee}`
        );
      }
      continue;
    }
    throw new Error(`smart_wallet_unsupported_compute_budget_instruction: type ${data[0]}`);
  }
}
function extractTransfersFromInnerInstructions(innerInstructions, accountKeys) {
  if (!innerInstructions) return [];
  const transfers = [];
  for (const group of innerInstructions) {
    for (const ix of group.instructions) {
      const ixAny = ix;
      const parsed = ixAny.parsed;
      if (parsed && parsed.type === "transferChecked" && parsed.info) {
        const programId2 = String(ixAny.programId ?? "");
        if (!TOKEN_PROGRAMS.has(programId2)) continue;
        const info = parsed.info;
        const tokenAmount = info.tokenAmount;
        const amountStr = tokenAmount?.amount ?? String(info.amount ?? "0");
        transfers.push({
          programId: programId2,
          amount: BigInt(amountStr),
          mint: String(info.mint ?? ""),
          destination: String(info.destination ?? ""),
          authority: String(info.authority ?? info.owner ?? "")
        });
        continue;
      }
      const programIdIndex = ixAny.programIdIndex;
      const accounts = ixAny.accounts;
      const dataStr = ixAny.data;
      if (programIdIndex == null || !accounts || !dataStr) continue;
      const programId = accountKeys[programIdIndex];
      if (!programId || !TOKEN_PROGRAMS.has(programId)) continue;
      let data;
      try {
        data = getBase58Encoder2().encode(dataStr);
      } catch {
        continue;
      }
      if (data[0] !== IX_TOKEN_TRANSFER_CHECKED) continue;
      if (data.length < 9 || accounts.length < 4) continue;
      const amount = new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(
        1,
        true
      );
      const mint = accountKeys[accounts[1]];
      const destination = accountKeys[accounts[2]];
      const authority = accountKeys[accounts[3]];
      if (!mint || !destination || !authority) continue;
      transfers.push({ programId, amount, mint, destination, authority });
    }
  }
  return transfers;
}
async function verifySmartWalletTransaction(transactionBase64, requirements, signer, feePayerAddress, signerAddresses, options) {
  const transaction = decodeTransactionFromPayload({ transaction: transactionBase64 });
  try {
    await assertFeePayerIsolated(transaction, feePayerAddress, signer, requirements.network);
  } catch (error) {
    return {
      isValid: false,
      invalidReason: error instanceof Error ? error.message : "smart_wallet_fee_payer_not_isolated",
      payer: ""
    };
  }
  try {
    validateComputeBudgetLimits(transaction, {
      maxComputeUnits: options?.maxComputeUnits,
      maxPriorityFeeMicroLamports: options?.maxPriorityFeeMicroLamports
    });
  } catch (error) {
    return {
      isValid: false,
      invalidReason: error instanceof Error ? error.message : "smart_wallet_compute_budget_violation",
      payer: ""
    };
  }
  if (typeof signer.simulateTransactionWithInnerInstructions !== "function") {
    return {
      isValid: false,
      invalidReason: "smart_wallet_verification_not_available",
      payer: ""
    };
  }
  let simResult;
  try {
    simResult = await signer.simulateTransactionWithInnerInstructions(
      transactionBase64,
      feePayerAddress,
      requirements.network
    );
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `smart_wallet_simulation_failed: ${error instanceof Error ? error.message : String(error)}`,
      payer: ""
    };
  }
  const compiled = getCompiledTransactionMessageDecoder4().decode(transaction.messageBytes);
  const decompiled = decompileTransactionMessage(compiled);
  const accountKeys = (compiled.staticAccounts ?? []).map(String);
  const expectedMemo = requirements.extra?.memo;
  if (expectedMemo) {
    const memoInstructions = (decompiled.instructions ?? []).filter(
      (ix) => ix.programAddress.toString() === MEMO_PROGRAM_ADDRESS
    );
    if (memoInstructions.length !== 1) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_memo_count",
        payer: ""
      };
    }
    const memoData = memoInstructions[0].data;
    const actualMemo = memoData ? new TextDecoder().decode(new Uint8Array(memoData)) : "";
    if (actualMemo !== expectedMemo) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_memo_mismatch",
        payer: ""
      };
    }
  }
  const allTransfers = [];
  for (const ix of decompiled.instructions ?? []) {
    const progId = ix.programAddress.toString();
    if (!TOKEN_PROGRAMS.has(progId)) continue;
    const data = ix.data;
    if (!data || data[0] !== IX_TOKEN_TRANSFER_CHECKED || data.length < 9) continue;
    const accts = ix.accounts ?? [];
    if (accts.length < 4) continue;
    const amount = new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(
      1,
      true
    );
    allTransfers.push({
      programId: progId,
      amount,
      mint: accts[1].address.toString(),
      destination: accts[2].address.toString(),
      authority: accts[3].address.toString()
    });
  }
  allTransfers.push(
    ...extractTransfersFromInnerInstructions(simResult.innerInstructions, accountKeys)
  );
  for (const t of allTransfers) {
    if (signerAddresses.includes(t.authority)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
        payer: t.authority
      };
    }
  }
  const expectedATAs = /* @__PURE__ */ new Set();
  for (const tokenProgram of [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS]) {
    try {
      const [ata] = await findAssociatedTokenPda4({
        mint: requirements.asset,
        owner: requirements.payTo,
        tokenProgram
      });
      expectedATAs.add(ata.toString());
    } catch {
    }
  }
  if (expectedATAs.size === 0) {
    return {
      isValid: false,
      invalidReason: "smart_wallet_cannot_derive_destination_ata",
      payer: ""
    };
  }
  const requiredAmount = BigInt(requirements.amount);
  const matchingTransfers = allTransfers.filter(
    (t) => t.mint === requirements.asset && expectedATAs.has(t.destination) && t.amount >= requiredAmount
  );
  if (matchingTransfers.length === 0) {
    if (allTransfers.length === 0) {
      return { isValid: false, invalidReason: "smart_wallet_no_transfer_in_simulation", payer: "" };
    }
    return {
      isValid: false,
      invalidReason: "smart_wallet_transfer_mismatch",
      payer: allTransfers[0].authority
    };
  }
  if (matchingTransfers.length > 1) {
    return {
      isValid: false,
      invalidReason: "smart_wallet_multiple_matching_transfers",
      payer: matchingTransfers[0].authority
    };
  }
  return { isValid: true, payer: matchingTransfers[0].authority };
}
async function verifyPostSettlement(signer, signature, network, requirements, signerAddresses, balanceBefore, balanceBeforeTokenProgram) {
  const requiredAmount = BigInt(requirements.amount);
  if (typeof signer.getConfirmedTransactionInnerInstructions === "function") {
    let confirmed = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        confirmed = await signer.getConfirmedTransactionInnerInstructions(signature, network);
        if (confirmed?.innerInstructions) break;
      } catch {
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    try {
      if (confirmed?.innerInstructions) {
        const transfers = extractTransfersFromInnerInstructions(confirmed.innerInstructions, []);
        const expectedATAs = /* @__PURE__ */ new Set();
        for (const tokenProgram of [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS]) {
          try {
            const [ata] = await findAssociatedTokenPda4({
              mint: requirements.asset,
              owner: requirements.payTo,
              tokenProgram
            });
            expectedATAs.add(ata.toString());
          } catch {
          }
        }
        const matching = transfers.filter(
          (t) => t.mint === requirements.asset && expectedATAs.has(t.destination) && t.amount >= requiredAmount && !signerAddresses.includes(t.authority)
        );
        if (matching.length >= 1) {
          return { verified: true, method: "innerInstructions" };
        }
        return { verified: false, method: "innerInstructions" };
      }
    } catch {
    }
  }
  if (balanceBefore !== null && typeof signer.getTokenAccountBalance === "function") {
    const tokenProgramsToCheck = balanceBeforeTokenProgram ? [
      balanceBeforeTokenProgram,
      ...balanceBeforeTokenProgram === TOKEN_PROGRAM_ADDRESS.toString() ? [TOKEN_2022_PROGRAM_ADDRESS] : [TOKEN_PROGRAM_ADDRESS]
    ] : [
      TOKEN_PROGRAM_ADDRESS,
      TOKEN_2022_PROGRAM_ADDRESS
    ];
    let anyBalanceChecked = false;
    for (const tokenProgram of tokenProgramsToCheck) {
      try {
        const [destinationAta] = await findAssociatedTokenPda4({
          mint: requirements.asset,
          owner: requirements.payTo,
          tokenProgram
        });
        const balanceAfter = await signer.getTokenAccountBalance(
          destinationAta.toString(),
          network
        );
        if (balanceAfter !== null) {
          anyBalanceChecked = true;
          if (balanceAfter - balanceBefore >= requiredAmount) {
            return { verified: true, method: "balanceDelta" };
          }
        }
      } catch {
      }
    }
    if (anyBalanceChecked) {
      return { verified: false, method: "balanceDelta" };
    }
  }
  return { verified: false, method: "unverified" };
}

// ../../node_modules/.pnpm/@x402+svm@file+.x402-vendor+x402-svm-2.23.0.tgz_@solana+kit@6.10.0_bufferutil@4.1.0_fas_4024990b1dd87ed6a149db0849575943/node_modules/@x402/svm/dist/esm/index.mjs
import { fetchAddressesForLookupTables, getBase64EncodedWireTransaction as getBase64EncodedWireTransaction3 } from "@solana/kit";
function createRpcCapabilitiesFromRpc(rpc) {
  return {
    getBalance: async (address6) => {
      const result = await rpc.getBalance(address6).send();
      return result.value;
    },
    getTokenAccountBalance: async (address6) => {
      const accountInfo = await rpc.getAccountInfo(address6, {
        encoding: "jsonParsed"
      }).send();
      if (!accountInfo.value) {
        throw new Error(`Token account not found: ${address6}`);
      }
      const parsed = accountInfo.value.data;
      return BigInt(parsed.parsed.info.tokenAmount.amount);
    },
    getLatestBlockhash: async () => {
      const result = await rpc.getLatestBlockhash().send();
      return {
        blockhash: result.value.blockhash,
        lastValidBlockHeight: result.value.lastValidBlockHeight
      };
    },
    simulateTransaction: async (transaction, config) => {
      return await rpc.simulateTransaction(transaction, config).send();
    },
    sendTransaction: async (transaction) => {
      return await rpc.sendTransaction(transaction, {
        encoding: "base64"
      }).send();
    },
    confirmTransaction: async (signature) => {
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30;
      while (!confirmed && attempts < maxAttempts) {
        const status = await rpc.getSignatureStatuses([signature]).send();
        const entry = status.value[0];
        if (entry?.confirmationStatus === "confirmed" || entry?.confirmationStatus === "finalized") {
          if (entry.err) {
            const errorStr = JSON.stringify(
              entry.err,
              (_, v) => typeof v === "bigint" ? v.toString() : v
            );
            throw new Error(`Transaction failed onchain: ${errorStr}`);
          }
          confirmed = true;
          return entry;
        }
        await new Promise((resolve) => setTimeout(resolve, 1e3));
        attempts++;
      }
      throw new Error("Transaction confirmation timeout");
    },
    fetchMint: async (address6) => {
      const { fetchMint } = await import("@solana-program/token-2022");
      return await fetchMint(rpc, address6);
    }
  };
}
function toFacilitatorSvmSigner(signer, rpcConfig) {
  let rpcMap = {};
  let defaultRpcUrl;
  if (rpcConfig) {
    if ("defaultRpcUrl" in rpcConfig && typeof rpcConfig.defaultRpcUrl === "string") {
      defaultRpcUrl = rpcConfig.defaultRpcUrl;
    } else if ("getBalance" in rpcConfig || "getSlot" in rpcConfig) {
      rpcMap["*"] = rpcConfig;
    } else {
      rpcMap = rpcConfig;
    }
  }
  const getRpcForNetwork = (network) => {
    if (rpcMap[network]) {
      return rpcMap[network];
    }
    if (rpcMap["*"]) {
      return rpcMap["*"];
    }
    return createRpcClient(network, defaultRpcUrl);
  };
  return {
    getAddresses: () => {
      return [signer.address];
    },
    getSigner: (feePayer) => {
      if (feePayer !== signer.address) {
        throw new Error(`No signer for feePayer ${feePayer}. Available: ${signer.address}`);
      }
      return signer;
    },
    signTransaction: async (transaction, feePayer, _) => {
      if (feePayer !== signer.address) {
        throw new Error(`No signer for feePayer ${feePayer}. Available: ${signer.address}`);
      }
      const tx = decodeTransactionFromPayload({ transaction });
      const signableMessage = {
        content: tx.messageBytes,
        signatures: tx.signatures
      };
      const [facilitatorSignatureDictionary] = await signer.signMessages([
        signableMessage
      ]);
      const fullySignedTx = {
        ...tx,
        signatures: {
          ...tx.signatures,
          ...facilitatorSignatureDictionary
        }
      };
      return getBase64EncodedWireTransaction3(fullySignedTx);
    },
    simulateTransaction: async (transaction, network) => {
      const rpc = getRpcForNetwork(network);
      const result = await rpc.simulateTransaction(transaction, {
        sigVerify: true,
        replaceRecentBlockhash: false,
        commitment: "confirmed",
        encoding: "base64"
      }).send();
      if (result.value.err) {
        const errorStr = JSON.stringify(
          result.value.err,
          (_, v) => typeof v === "bigint" ? v.toString() : v
        );
        throw new Error(`Simulation failed: ${errorStr}`);
      }
    },
    sendTransaction: async (transaction, network) => {
      const rpc = getRpcForNetwork(network);
      return await rpc.sendTransaction(transaction, {
        encoding: "base64"
      }).send();
    },
    confirmTransaction: async (signature, network) => {
      const rpc = getRpcForNetwork(network);
      const rpcCapabilities = createRpcCapabilitiesFromRpc(rpc);
      await rpcCapabilities.confirmTransaction(signature);
    },
    simulateTransactionWithInnerInstructions: async (transaction, feePayer, network) => {
      if (feePayer !== signer.address) {
        throw new Error(`No signer for feePayer ${feePayer}. Available: ${signer.address}`);
      }
      const tx = decodeTransactionFromPayload({ transaction });
      const signableMessage = {
        content: tx.messageBytes,
        signatures: tx.signatures
      };
      const [facilitatorSignatureDictionary] = await signer.signMessages([
        signableMessage
      ]);
      const signedTx = {
        ...tx,
        signatures: { ...tx.signatures, ...facilitatorSignatureDictionary }
      };
      const signedBase64 = getBase64EncodedWireTransaction3(signedTx);
      const rpc = getRpcForNetwork(network);
      const result = await rpc.simulateTransaction(
        signedBase64,
        {
          sigVerify: true,
          replaceRecentBlockhash: false,
          commitment: "confirmed",
          encoding: "base64",
          innerInstructions: true
        }
      ).send();
      const value = result.value;
      if (value.err) {
        const errorStr = JSON.stringify(
          value.err,
          (_, v) => typeof v === "bigint" ? v.toString() : v
        );
        throw new Error(`Smart wallet simulation failed: ${errorStr}`);
      }
      return { innerInstructions: value.innerInstructions ?? null };
    },
    getConfirmedTransactionInnerInstructions: async (signature, network) => {
      const rpc = getRpcForNetwork(network);
      const result = await rpc.getTransaction(
        signature,
        {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
          encoding: "jsonParsed"
        }
      ).send();
      if (!result) {
        return null;
      }
      const meta = result.meta;
      return { innerInstructions: meta?.innerInstructions ?? null };
    },
    getTokenAccountBalance: async (tokenAccountAddress, network) => {
      const rpc = getRpcForNetwork(network);
      try {
        const result = await rpc.getTokenAccountBalance(
          tokenAccountAddress,
          { commitment: "confirmed" }
        ).send();
        const amount = result.value?.amount;
        return amount ? BigInt(amount) : null;
      } catch {
        return null;
      }
    },
    fetchAddressLookupTables: async (lookupTableAddresses, network) => {
      const rpc = getRpcForNetwork(network);
      try {
        const resolved = await fetchAddressesForLookupTables(
          lookupTableAddresses.map((a) => a),
          rpc
        );
        const result = {};
        for (const [key, addresses] of Object.entries(resolved)) {
          result[key] = addresses.map((a) => a.toString());
        }
        return result;
      } catch (error) {
        throw new Error(
          `smart_wallet_alt_resolution_failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  };
}

// ../../node_modules/.pnpm/@x402+svm@file+.x402-vendor+x402-svm-2.23.0.tgz_@solana+kit@6.10.0_bufferutil@4.1.0_fas_4024990b1dd87ed6a149db0849575943/node_modules/@x402/svm/dist/esm/upto/facilitator/index.mjs
import { createHash } from "crypto";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
  parseSetComputeUnitPriceInstruction
} from "@solana-program/compute-budget";
import {
  address as address5,
  addSignersToInstruction,
  appendTransactionMessageInstructions as appendTransactionMessageInstructions2,
  createNoopSigner,
  createTransactionMessage as createTransactionMessage2,
  decompileTransactionMessage as decompileTransactionMessage2,
  getBase58Encoder as getBase58Encoder3,
  getBase64Codec as getBase64Codec5,
  getBase64EncodedWireTransaction as getBase64EncodedWireTransaction4,
  getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder5,
  getTransactionDecoder as getTransactionDecoder5,
  partiallySignTransactionMessageWithSigners,
  pipe as pipe2,
  setTransactionMessageFeePayerSigner as setTransactionMessageFeePayerSigner2,
  setTransactionMessageLifetimeUsingBlockhash as setTransactionMessageLifetimeUsingBlockhash2,
  signTransactionMessageWithSigners as signTransactionMessageWithSigners2
} from "@solana/kit";
import {
  assertAccountExists,
  assertAccountsExist,
  combineCodec as combineCodec3,
  decodeAccount,
  fetchEncodedAccount,
  fetchEncodedAccounts,
  getAddressDecoder as getAddressDecoder2,
  getAddressEncoder as getAddressEncoder2,
  getArrayDecoder as getArrayDecoder2,
  getArrayEncoder as getArrayEncoder2,
  getI64Decoder as getI64Decoder2,
  getI64Encoder as getI64Encoder2,
  getStructDecoder as getStructDecoder3,
  getStructEncoder as getStructEncoder3,
  getU32Decoder,
  getU32Encoder,
  getU64Decoder as getU64Decoder3,
  getU64Encoder as getU64Encoder3,
  getU8Decoder as getU8Decoder2,
  getU8Encoder as getU8Encoder2
} from "@solana/kit";
import {
  combineCodec,
  getStructDecoder,
  getStructEncoder,
  getU64Decoder,
  getU64Encoder as getU64Encoder2
} from "@solana/kit";
import {
  combineCodec as combineCodec2,
  getAddressDecoder,
  getAddressEncoder as getAddressEncoder3,
  getArrayDecoder,
  getArrayEncoder,
  getStructDecoder as getStructDecoder2,
  getStructEncoder as getStructEncoder2,
  getU8Decoder,
  getU8Encoder
} from "@solana/kit";
import { address as address32 } from "@solana/kit";
import { address as address22 } from "@solana/kit";
function getSettlementWatermarksDecoder() {
  return getStructDecoder([
    ["settled", getU64Decoder()],
    ["payoutWatermark", getU64Decoder()]
  ]);
}
function getChannelDecoder() {
  return getStructDecoder3([
    ["discriminator", getU8Decoder2()],
    ["version", getU8Decoder2()],
    ["bump", getU8Decoder2()],
    ["status", getU8Decoder2()],
    ["salt", getU64Decoder3()],
    ["deposit", getU64Decoder3()],
    ["settlement", getSettlementWatermarksDecoder()],
    ["closureStartedAt", getI64Decoder2()],
    ["payerWithdrawnAt", getI64Decoder2()],
    ["gracePeriod", getU32Decoder()],
    ["distributionHash", getArrayDecoder2(getU8Decoder2(), { size: 32 })],
    ["payer", getAddressDecoder2()],
    ["payee", getAddressDecoder2()],
    ["authorizedSigner", getAddressDecoder2()],
    ["mint", getAddressDecoder2()],
    ["rentPayer", getAddressDecoder2()],
    ["openSlot", getU64Decoder3()]
  ]);
}
function decodeChannel(encodedAccount) {
  return decodeAccount(encodedAccount, getChannelDecoder());
}
async function fetchMaybeChannel(rpc, address42, config) {
  const maybeAccount = await fetchEncodedAccount(rpc, address42, config);
  return decodeChannel(maybeAccount);
}
var CHANNEL_ACCOUNT_DISCRIMINATOR = 1;
var CHANNEL_STATUS_OPEN = 0;
var MAX_TRANSACTION_COMPUTE_UNITS = 14e5;
var SIM_COMPUTE_UNIT_LIMIT = MAX_TRANSACTION_COMPUTE_UNITS;
var CHANNEL_READ_MAX_ATTEMPTS = 5;
var CHANNEL_READ_INITIAL_BACKOFF_MS = 200;
var DEFAULT_SETTLE_COMPUTE_UNIT_LIMIT = 1e5;
var RECLAIM_COMPUTE_UNIT_BASE = 25e3;
var RECLAIM_COMPUTE_UNIT_PER_CHANNEL = 5e3;
function reclaimComputeUnitLimit(channelCount) {
  return Math.min(
    RECLAIM_COMPUTE_UNIT_BASE + RECLAIM_COMPUTE_UNIT_PER_CHANNEL * channelCount,
    MAX_TRANSACTION_COMPUTE_UNITS
  );
}
async function channelExists(rpc, channelId) {
  const info = await rpc.getAccountInfo(address5(channelId), { commitment: STATE_COMMITMENT, encoding: "base64" }).send();
  return info.value !== null;
}
async function fetchAndVerifyOpenChannel(rpc, channelId, expected) {
  for (let attempt = 1; attempt <= CHANNEL_READ_MAX_ATTEMPTS; attempt++) {
    const account = await fetchMaybeChannel(rpc, address5(channelId), {
      commitment: STATE_COMMITMENT
    });
    if (account.exists) {
      return verifyOpenChannelAccount(channelId, account.data, expected);
    }
    if (attempt === CHANNEL_READ_MAX_ATTEMPTS) {
      break;
    }
    const delayMs = CHANNEL_READ_INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`channel ${channelId} does not exist`);
}
function verifyOpenChannelAccount(channelId, channel, expected) {
  if (channel.discriminator !== CHANNEL_ACCOUNT_DISCRIMINATOR) {
    throw new Error(`channel ${channelId} has an invalid account discriminator`);
  }
  if (channel.status !== CHANNEL_STATUS_OPEN) {
    throw new Error(`channel ${channelId} is not open`);
  }
  assertChannelAddress("mint", channel.mint, expected.mint);
  assertChannelAddress("payee", channel.payee, expected.payee);
  assertChannelAddress("authorized signer", channel.authorizedSigner, expected.authorizedSigner);
  assertChannelAddress("rent payer", channel.rentPayer, expected.rentPayer);
  assertChannelAddress("payer", channel.payer, expected.payer);
  if (channel.gracePeriod !== expected.gracePeriod) {
    throw new Error(
      `channel grace period ${channel.gracePeriod} != expected ${expected.gracePeriod}`
    );
  }
  if (channel.deposit !== expected.deposit) {
    throw new Error(`channel deposit ${channel.deposit} != expected ${expected.deposit}`);
  }
  const expectedDistributionHash = getChannelDistributionHash(expected.splits);
  if (channel.distributionHash.length !== expectedDistributionHash.length || channel.distributionHash.some((value, index) => value !== expectedDistributionHash[index])) {
    throw new Error("channel distribution does not match the expected recipient split");
  }
  return {
    authorizedSigner: expected.authorizedSigner,
    channelId,
    deposit: channel.deposit,
    mint: channel.mint,
    openSlot: channel.openSlot,
    payee: channel.payee,
    payer: channel.payer,
    rentPayer: channel.rentPayer,
    splits: expected.splits
  };
}
async function broadcastOpen(facilitator, feePayer, network, openTransactionBase64) {
  const wire = await facilitator.signTransaction(openTransactionBase64, feePayer, network);
  const signature = await facilitator.sendTransaction(wire, network);
  await facilitator.confirmTransaction(signature, network);
  return signature;
}
async function simulateOpenSettleDistribute(feePayer, rpc, args) {
  const { channel, openTransactionBase64 } = args;
  const tx = getTransactionDecoder5().decode(getBase64Codec5().encode(openTransactionBase64));
  const compiled = getCompiledTransactionMessageDecoder5().decode(tx.messageBytes);
  const decompiled = decompileTransactionMessage2(compiled);
  const openInstructions = decompiled.instructions ?? [];
  let computeUnitPrice;
  const nonComputeBudget = [];
  for (const ix of openInstructions) {
    if (ix.programAddress.toString() !== COMPUTE_BUDGET_PROGRAM_ADDRESS) {
      nonComputeBudget.push(ix);
      continue;
    }
    if (ix.data && ix.data.length > 0 && ix.data[0] === 3) {
      parseSetComputeUnitPriceInstruction(ix);
      computeUnitPrice = ix;
    }
  }
  const payerSigner = channel.payer === feePayer.address ? feePayer : createNoopSigner(address5(channel.payer));
  const openWithPayer = nonComputeBudget.map(
    (ix) => addSignersToInstruction([payerSigner, feePayer], ix)
  );
  const settle = buildSettleAndSealInstructions({
    channelId: channel.channelId,
    payeeSigner: feePayer
  });
  const distribute = await buildDistributeInstruction({
    channelId: channel.channelId,
    mint: channel.mint,
    network: channel.network,
    payee: channel.payee,
    payer: channel.payer,
    rentPayer: channel.rentPayer,
    splits: channel.splits,
    tokenProgram: channel.tokenProgram
  });
  const instructions = [
    getSetComputeUnitLimitInstruction({ units: SIM_COMPUTE_UNIT_LIMIT }),
    ...computeUnitPrice ? [computeUnitPrice] : [],
    ...openWithPayer,
    ...settle,
    distribute
  ];
  await simulateInstructions(feePayer, rpc, instructions);
}
async function submitSettle(feePayer, rpc, instructions, options = {}) {
  const computeUnitLimit = options.computeUnitLimit ?? DEFAULT_SETTLE_COMPUTE_UNIT_LIMIT;
  const computeUnitPrice = options.computeUnitPriceMicroLamports ?? DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS;
  const computeBudgetIxs = [
    getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
    ...computeUnitPrice > 0 ? [getSetComputeUnitPriceInstruction({ microLamports: computeUnitPrice })] : []
  ];
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: BLOCKHASH_COMMITMENT }).send();
  const message = pipe2(
    createTransactionMessage2({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner2(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash2(
      {
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      m
    ),
    (m) => appendTransactionMessageInstructions2([...computeBudgetIxs, ...instructions], m)
  );
  const signed = await signTransactionMessageWithSigners2(message);
  const wire = getBase64EncodedWireTransaction4(signed);
  const signature = await rpc.sendTransaction(wire, { encoding: "base64" }).send();
  await confirmSignature(rpc, signature);
  return signature;
}
var SettlementConfirmationTimeoutError = class extends Error {
  /**
   * Create the error for a signature whose confirmation timed out.
   *
   * @param signature - The transaction signature whose confirmation timed out
   */
  constructor(signature) {
    super(`timed out waiting for tx ${signature} confirmation`);
    this.signature = signature;
    this.name = "SettlementConfirmationTimeoutError";
  }
};
async function confirmSignature(rpc, signature, timeoutMs = 3e4) {
  const deadline = Date.now() + timeoutMs;
  for (; ; ) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    const status = value[0];
    if (status) {
      if (status.err) {
        const errorStr = JSON.stringify(
          status.err,
          (_, v) => typeof v === "bigint" ? v.toString() : v
        );
        throw new Error(`tx ${signature} failed onchain: ${errorStr}`);
      }
      const level = status.confirmationStatus;
      if (level === void 0 || level === null || level === "confirmed" || level === "finalized") {
        return;
      }
    }
    if (Date.now() >= deadline) {
      throw new SettlementConfirmationTimeoutError(signature);
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
  }
}
function assertChannelAddress(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`channel ${label} ${actual} != expected ${expected}`);
  }
}
function getChannelDistributionHash(splits) {
  const hasher = createHash("sha256");
  const count = new Uint8Array(4);
  new DataView(count.buffer).setUint32(0, splits.length, true);
  hasher.update(count);
  for (const split of splits) {
    hasher.update(Uint8Array.from(getBase58Encoder3().encode(split.recipient)));
    const bps = new Uint8Array(2);
    new DataView(bps.buffer).setUint16(0, split.bps, true);
    hasher.update(bps);
  }
  return hasher.digest();
}
async function simulateInstructions(feePayer, rpc, instructions) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: BLOCKHASH_COMMITMENT }).send();
  const message = pipe2(
    createTransactionMessage2({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner2(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash2(
      {
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      m
    ),
    (m) => appendTransactionMessageInstructions2(instructions, m)
  );
  const signed = await partiallySignTransactionMessageWithSigners(message);
  const wire = getBase64EncodedWireTransaction4(signed);
  const result = await rpc.simulateTransaction(wire, {
    commitment: STATE_COMMITMENT,
    encoding: "base64",
    replaceRecentBlockhash: true,
    sigVerify: false
  }).send();
  if (result.value.err) {
    const errorStr = JSON.stringify(
      result.value.err,
      (_, v) => typeof v === "bigint" ? v.toString() : v
    );
    throw new Error(`zero-charge settlement simulation failed: ${errorStr}`);
  }
}
var InMemoryUptoChannelStorage = class {
  constructor() {
    this.channels = /* @__PURE__ */ new Map();
  }
  /**
   * Look up a single stored channel.
   *
   * @param channelId - Channel PDA
   * @returns Stored record, or undefined when absent
   */
  async get(channelId) {
    return this.channels.get(channelId);
  }
  /**
   * List every stored channel record.
   *
   * @returns All stored channel records
   */
  async list() {
    return [...this.channels.values()];
  }
  /**
   * Insert or replace a record. Keeps the earlier `firstSeenAt` and the
   * later `expiresAt` when the channel was already stored.
   *
   * @param record - Full channel storage record
   */
  async upsert(record) {
    const existing = this.channels.get(record.channelId);
    this.channels.set(record.channelId, {
      ...record,
      firstSeenAt: existing?.firstSeenAt ?? record.firstSeenAt,
      expiresAt: existing ? Math.max(existing.expiresAt, record.expiresAt) : record.expiresAt
    });
  }
  /**
   * Remove a channel from storage.
   *
   * @param channelId - Channel PDA to remove
   */
  async delete(channelId) {
    this.channels.delete(channelId);
  }
};
var CHANNEL_ACCOUNT_SIZE = 256n;
var CHANNEL_RENT_PAYER_OFFSET = 216n;
async function discoverChannelsByRentPayer(rpc, rentPayer, programId) {
  const program = address22(programId ?? PAYMENT_CHANNELS_PROGRAM_ID);
  const results = await rpc.getProgramAccounts(program, {
    commitment: "confirmed",
    encoding: "base64",
    filters: [
      { dataSize: CHANNEL_ACCOUNT_SIZE },
      {
        memcmp: {
          bytes: rentPayer,
          encoding: "base58",
          offset: CHANNEL_RENT_PAYER_OFFSET
        }
      }
    ]
  }).send();
  const discovered = [];
  for (const result of results) {
    const validated = await validateDiscoveredAccount(
      result.pubkey,
      result.account.owner,
      result.account.data[0],
      program
    );
    if (validated) discovered.push(validated);
  }
  return discovered;
}
async function validateDiscoveredAccount(pubkey, owner, base64Data, expectedProgram) {
  if (owner !== expectedProgram) return void 0;
  const bytes = Buffer.from(base64Data, "base64");
  if (bytes.byteLength < Number(CHANNEL_ACCOUNT_SIZE)) return void 0;
  let channel;
  try {
    channel = getChannelDecoder().decode(bytes);
  } catch {
    return void 0;
  }
  if (channel.discriminator !== 1) return void 0;
  const derived = await findPaymentChannelPda({
    authorizedSigner: channel.authorizedSigner,
    mint: channel.mint,
    openSlot: channel.openSlot,
    payee: channel.payee,
    payer: channel.payer,
    salt: channel.salt
  });
  if (derived !== pubkey) return void 0;
  return { channelId: pubkey, channel };
}
function compareChannelId(a, b) {
  if (a.channelId < b.channelId) return -1;
  if (a.channelId > b.channelId) return 1;
  return 0;
}
function orderForScan(records, cursor) {
  const sorted = [...records].sort(compareChannelId);
  if (!cursor) return sorted;
  const index = sorted.findIndex((record) => record.channelId === cursor);
  if (index === -1) return sorted;
  return [...sorted.slice(index), ...sorted.slice(0, index)];
}
function passAbort(...signals) {
  const active = signals.filter((signal) => signal !== void 0);
  return {
    throwIfAborted: () => {
      for (const signal of active) signal.throwIfAborted();
    },
    aborted: () => active.some((signal) => signal.aborted)
  };
}
function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError";
}
function resolveCleanupCount(value, defaultValue, max) {
  const resolved = value !== void 0 && Number.isFinite(value) && value > 0 ? value : defaultValue;
  return max !== void 0 ? Math.min(resolved, max) : resolved;
}
var DEFAULT_ABANDON_GRACE_SECS = 120;
var DEFAULT_MAX_RECLAIMS_PER_TX = 8;
var MAX_SAFE_RECLAIMS_PER_TX = 16;
var DEFAULT_MAX_TXS_PER_RUN = 20;
var DEFAULT_MAX_TXS_PER_SIGNER = 20;
var DEFAULT_MAX_CLOSES_PER_RUN = 10;
var UptoSvmRentCleanupManager = class {
  /**
   * Create a rent cleanup manager for one network.
   *
   * @param config - Signer pool, channel storage, and network/RPC
   */
  constructor(config) {
    this.running = false;
    this.tickInFlight = false;
    this.discoveryTickInFlight = false;
    this.passQueue = Promise.resolve();
    this.scanCursor = "";
    if (typeof config.signer.getSigner !== "function") {
      throw new Error(
        "UptoSvmRentCleanupManager requires getSigner on the signer. Use toFacilitatorSvmSigner() which provides all required methods."
      );
    }
    this.getKitSigner = config.signer.getSigner.bind(config.signer);
    this.signer = config.signer;
    this.storage = config.storage;
    this.network = config.network;
    this.rpcUrl = config.rpcUrl;
    this.computeUnitPriceMicroLamports = config.computeUnitPriceMicroLamports;
    this.settleComputeUnitLimit = config.settleComputeUnitLimit;
    this.rpc = config.rpc;
  }
  /**
   * Clean up whatever is ready: abandon-close timed-out Open channels,
   * distribute Sealed ones, batch-reclaim Distributed channels past the
   * open-slot gate. Defers Closing / too-early / still-active Open.
   *
   * @param opts - Work caps and callbacks
   * @returns A promise that resolves when this pass completes
   */
  async cleanup(opts = {}) {
    return this.enqueue(() => this.runPass(opts));
  }
  /**
   * Find Distributed channels this facilitator paid rent for that storage does
   * not know about, and add them so {@link cleanup} reclaims them on a later
   * pass. The spec §6 recovery path for a lost or incomplete work index.
   *
   * A sweep is a `getProgramAccounts` scan per managed signer key, which is
   * far more expensive than a cleanup pass — run it rarely (see
   * `discoveryIntervalSecs`), not on the cleanup interval.
   *
   * Discovered records carry only what the chain proves: `payTo`,
   * `tokenProgram`, and `expiresAt` are empty. That is safe because only the
   * Open and Sealed cleanup branches read them, and a Distributed channel
   * never returns to those states. Channel ids already in storage are left
   * alone so a full record is never overwritten with a partial one.
   *
   * @param opts - Cancellation and callbacks
   * @returns A promise that resolves when this sweep completes
   */
  async discover(opts = {}) {
    return this.enqueue(() => this.runDiscovery(opts));
  }
  /**
   * Start the interval loops: {@link cleanup} always, {@link discover} only
   * when `discoveryIntervalSecs` is set.
   *
   * @param config - Intervals and cleanup policy
   */
  start(config) {
    if (this.running) return;
    this.running = true;
    this.startConfig = config;
    this.abortController = new AbortController();
    this.timer = setInterval(() => {
      void this.tick();
    }, config.intervalSecs * 1e3);
    if (config.discoveryIntervalSecs !== void 0) {
      this.discoveryTimer = setInterval(() => {
        void this.discoveryTick();
      }, config.discoveryIntervalSecs * 1e3);
    }
  }
  /**
   * Stop the interval loops and wait for the pass they left in flight.
   *
   * Cancels at the pass's next scan / discovery / reclaim checkpoint rather
   * than mid-transaction, so a submitted settle is always awaited to its
   * signature and its storage entry updated. Resolves once nothing is running,
   * which makes it safe to await during shutdown.
   *
   * @returns A promise that resolves when the in-flight pass has unwound
   */
  async stop() {
    this.running = false;
    if (this.timer !== void 0) {
      clearInterval(this.timer);
      this.timer = void 0;
    }
    if (this.discoveryTimer !== void 0) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = void 0;
    }
    this.abortController?.abort();
    await this.passQueue;
    this.abortController = void 0;
    this.startConfig = void 0;
  }
  /**
   * Queue a pass behind whatever is already running.
   *
   * @param pass - The pass to run once the queue drains
   * @returns The pass's own promise, rejection included
   */
  enqueue(pass) {
    const queued = this.passQueue.then(pass);
    this.passQueue = queued.catch(() => void 0);
    return queued;
  }
  /**
   * Run one cleanup pass. Callers go through {@link cleanup}, which serializes
   * passes.
   *
   * @param opts - Work caps and callbacks
   */
  async runPass(opts) {
    const abandonGraceSecs = resolveCleanupCount(opts.abandonGraceSecs, DEFAULT_ABANDON_GRACE_SECS);
    const maxReclaimsPerTx = resolveCleanupCount(
      opts.maxReclaimsPerTx,
      DEFAULT_MAX_RECLAIMS_PER_TX,
      MAX_SAFE_RECLAIMS_PER_TX
    );
    const maxTxsPerRun = resolveCleanupCount(opts.maxTxsPerRun, DEFAULT_MAX_TXS_PER_RUN);
    const maxTxsPerSigner = resolveCleanupCount(opts.maxTxsPerSigner, DEFAULT_MAX_TXS_PER_SIGNER);
    const maxClosesPerRun = resolveCleanupCount(opts.maxClosesPerRun, DEFAULT_MAX_CLOSES_PER_RUN);
    const abort = passAbort(this.abortController?.signal, opts.signal);
    const rpc = this.rpc ?? createRpcClient(this.network, this.rpcUrl);
    const records = orderForScan(await this.storage.list(), this.scanCursor);
    this.scanCursor = "";
    const nowSecs = Math.floor(Date.now() / 1e3);
    let currentSlot;
    let txsUsed = 0;
    let closesUsed = 0;
    const reclaimCandidates = [];
    const getCurrentSlot = async () => {
      currentSlot ?? (currentSlot = await rpc.getSlot({ commitment: SLOT_COMMITMENT }).send());
      return currentSlot;
    };
    for (const record of records) {
      if (txsUsed >= maxTxsPerRun) {
        this.scanCursor = record.channelId;
        break;
      }
      abort.throwIfAborted();
      if (record.network !== this.network) continue;
      try {
        const maybe = await fetchMaybeChannel(rpc, address32(record.channelId), {
          commitment: STATE_COMMITMENT
        });
        if (!maybe.exists) {
          await this.storage.delete(record.channelId);
          continue;
        }
        const live = maybe.data;
        const status = live.status;
        if (status === 1) {
          continue;
        }
        if (status === 0 || status === 2) {
          if (status === 0) {
            const readyAt = record.expiresAt + abandonGraceSecs;
            if (nowSecs < readyAt) continue;
          }
          if (closesUsed >= maxClosesPerRun) continue;
          if (!record.payTo) {
            opts.onError?.(new Error(`channel ${record.channelId} missing payTo; skipping`), {
              channelId: record.channelId
            });
            continue;
          }
          const feePayer = live.payee;
          const feePayerSigner = this.resolveFeePayer(feePayer);
          if (!feePayerSigner) {
            opts.onError?.(
              new Error(
                `channel ${record.channelId} feePayer ${feePayer} not in facilitator signer set`
              ),
              { channelId: record.channelId }
            );
            continue;
          }
          const signature = await this.submitCloseOrDistribute(
            feePayerSigner,
            rpc,
            record,
            live,
            status
          );
          closesUsed += 1;
          txsUsed += 1;
          opts.onClose?.({
            channelId: record.channelId,
            transaction: signature,
            action: status === 0 ? "abandon_close" : "distribute"
          });
          await this.syncStorageAfterAction(rpc, record.channelId);
          continue;
        }
        if (status === 3) {
          const slot = await getCurrentSlot();
          if (slot > live.openSlot + OPEN_SLOT_WINDOW) {
            reclaimCandidates.push({
              channelId: record.channelId,
              rentPayer: live.rentPayer
            });
          }
          continue;
        }
        opts.onError?.(
          new Error(`channel ${record.channelId} has unrecognized status ${String(status)}`),
          { channelId: record.channelId }
        );
      } catch (error) {
        opts.onError?.(error, { channelId: record.channelId });
      }
    }
    await this.submitReclaimBatches(rpc, reclaimCandidates, {
      maxReclaimsPerTx,
      maxTxsPerSigner,
      abort,
      onReclaim: opts.onReclaim,
      onError: opts.onError
    });
  }
  /**
   * Run one discovery sweep. Callers go through {@link discover}, which
   * serializes it against cleanup passes.
   *
   * @param opts - Cancellation and callbacks
   */
  async runDiscovery(opts) {
    const abort = passAbort(this.abortController?.signal, opts.signal);
    const rpc = this.rpc ?? createRpcClient(this.network, this.rpcUrl);
    const known = new Set((await this.storage.list()).map((record) => record.channelId));
    const discovered = [];
    let currentSlot;
    for (const managed of this.signer.getAddresses()) {
      abort.throwIfAborted();
      let found;
      try {
        found = await discoverChannelsByRentPayer(rpc, managed);
      } catch (error) {
        opts.onError?.(error);
        continue;
      }
      currentSlot ?? (currentSlot = await rpc.getSlot({ commitment: SLOT_COMMITMENT }).send());
      for (const { channelId, channel } of found) {
        if (known.has(channelId)) continue;
        known.add(channelId);
        if (channel.status !== 3) continue;
        if (currentSlot <= channel.openSlot + OPEN_SLOT_WINDOW) continue;
        try {
          await this.storage.upsert({
            channelId,
            payTo: "",
            tokenProgram: "",
            firstSeenAt: Date.now(),
            expiresAt: 0,
            network: this.network
          });
          discovered.push(channelId);
        } catch (error) {
          opts.onError?.(error, { channelId });
        }
      }
    }
    if (discovered.length > 0) opts.onDiscover?.({ channelIds: discovered });
  }
  /**
   * Interval tick. Skips while a tick is outstanding so a pass slower than the
   * interval cannot pile up queued passes.
   */
  async tick() {
    const config = this.startConfig;
    if (!this.running || this.tickInFlight || !config) return;
    this.tickInFlight = true;
    try {
      await this.cleanup(config);
    } catch (error) {
      if (!isAbortError(error)) config.onError?.(error);
    } finally {
      this.tickInFlight = false;
    }
  }
  /**
   * Discovery tick. Skips while a sweep is outstanding, so a sweep slower than
   * its interval cannot pile up queued sweeps ahead of cleanup passes.
   */
  async discoveryTick() {
    const config = this.startConfig;
    if (!this.running || this.discoveryTickInFlight || !config) return;
    this.discoveryTickInFlight = true;
    try {
      await this.discover(config);
    } catch (error) {
      if (!isAbortError(error)) config.onError?.(error);
    } finally {
      this.discoveryTickInFlight = false;
    }
  }
  /**
   * Submit settle_and_seal(has_voucher=0)+distribute for Open, or distribute
   * alone for Sealed.
   *
   * @param feePayerSigner - Channel feePayer / payee signer
   * @param rpc - RPC client
   * @param record - Stored channel (must include payTo + tokenProgram)
   * @param live - Refetched channel account
   * @param status - Live status that selected this path
   * @returns Broadcast signature
   */
  async submitCloseOrDistribute(feePayerSigner, rpc, record, live, status) {
    const splits = [{ bps: BASIS_POINTS_DENOMINATOR, recipient: record.payTo }];
    const distribute = await buildDistributeInstruction({
      channelId: record.channelId,
      mint: live.mint,
      network: this.network,
      payee: live.payee,
      payer: live.payer,
      rentPayer: live.rentPayer,
      splits,
      tokenProgram: record.tokenProgram
    });
    const instructions = status === 0 ? [
      ...buildSettleAndSealInstructions({
        channelId: record.channelId,
        payeeSigner: feePayerSigner
      }),
      distribute
    ] : [distribute];
    return submitSettle(feePayerSigner, rpc, instructions, {
      computeUnitLimit: this.settleComputeUnitLimit,
      computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports
    });
  }
  /**
   * After a close/distribute, delete the storage entry if the PDA is gone.
   *
   * @param rpc - RPC client
   * @param channelId - Channel PDA
   */
  async syncStorageAfterAction(rpc, channelId) {
    const maybe = await fetchMaybeChannel(rpc, address32(channelId), {
      commitment: STATE_COMMITMENT
    });
    if (!maybe.exists) {
      await this.storage.delete(channelId);
    }
  }
  /**
   * Group reclaim candidates by rent_payer and run each group's batched
   * reclaim transactions concurrently, each against its own maxTxsPerSigner
   * budget.
   *
   * Submissions within a group stay sequential (each batch refetches live
   * state, so a group depends on its own prior submissions to avoid
   * double-reclaiming), but independent rent-payer groups do not share a
   * budget or depend on one another: adding managed signer keys adds
   * maxTxsPerSigner more reclaim throughput per pass, not a share of a fixed
   * pool.
   *
   * @param rpc - RPC client
   * @param candidates - Distributed channels ready to reclaim
   * @param opts - Batch size, tx budget, callbacks
   * @param opts.maxReclaimsPerTx - Max reclaim instructions per transaction
   * @param opts.maxTxsPerSigner - Max reclaim transactions per rent-payer group
   * @param opts.abort - Cancellation checked before each batch
   * @param opts.onReclaim - Optional success callback per reclaim batch
   * @param opts.onError - Optional error callback
   */
  async submitReclaimBatches(rpc, candidates, opts) {
    if (opts.maxTxsPerSigner <= 0 || candidates.length === 0) return;
    const byRentPayer = /* @__PURE__ */ new Map();
    for (const candidate of candidates) {
      const group = byRentPayer.get(candidate.rentPayer) ?? [];
      group.push(candidate);
      byRentPayer.set(candidate.rentPayer, group);
    }
    await Promise.all(
      Array.from(byRentPayer.entries()).map(
        ([rentPayer, group]) => this.submitReclaimGroup(rpc, rentPayer, group, opts, { remaining: opts.maxTxsPerSigner })
      )
    );
  }
  /**
   * Submit one rent payer's reclaim batches sequentially, claiming a slot
   * from the shared budget before each attempt.
   *
   * @param rpc - RPC client
   * @param rentPayer - Rent payer this group's channels share
   * @param group - This rent payer's reclaim candidates
   * @param opts - Batch size and callbacks
   * @param opts.maxReclaimsPerTx - Max reclaim instructions per transaction
   * @param opts.abort - Cancellation checked before each batch
   * @param opts.onReclaim - Optional success callback per reclaim batch
   * @param opts.onError - Optional error callback
   * @param budget - This group's remaining-transaction counter
   * @param budget.remaining - Reclaim transactions this rent payer may submit
   */
  async submitReclaimGroup(rpc, rentPayer, group, opts, budget) {
    const feePayerSigner = this.resolveFeePayer(rentPayer);
    if (!feePayerSigner) {
      for (const candidate of group) {
        opts.onError?.(
          new Error(
            `channel ${candidate.channelId} feePayer ${rentPayer} not in facilitator signer set`
          ),
          { channelId: candidate.channelId }
        );
      }
      return;
    }
    for (let i = 0; i < group.length; i += opts.maxReclaimsPerTx) {
      if (budget.remaining <= 0) return;
      if (opts.abort.aborted()) return;
      budget.remaining -= 1;
      const batch = group.slice(i, i + opts.maxReclaimsPerTx);
      try {
        const liveBatch = [];
        for (const candidate of batch) {
          const maybe = await fetchMaybeChannel(rpc, address32(candidate.channelId), {
            commitment: STATE_COMMITMENT
          });
          if (!maybe.exists) {
            await this.storage.delete(candidate.channelId);
            continue;
          }
          if (maybe.data.status !== 3) continue;
          liveBatch.push({
            channelId: candidate.channelId,
            rentPayer: maybe.data.rentPayer
          });
        }
        if (liveBatch.length === 0) continue;
        const instructions = liveBatch.map(
          (candidate) => buildReclaimInstruction({
            channelId: candidate.channelId,
            rentPayer: candidate.rentPayer
          })
        );
        const signature = await submitSettle(feePayerSigner, rpc, instructions, {
          computeUnitLimit: reclaimComputeUnitLimit(liveBatch.length),
          computeUnitPriceMicroLamports: this.computeUnitPriceMicroLamports
        });
        opts.onReclaim?.({
          channelIds: liveBatch.map((c) => c.channelId),
          transaction: signature
        });
        for (const candidate of liveBatch) {
          await this.storage.delete(candidate.channelId);
        }
      } catch (error) {
        for (const candidate of batch) {
          opts.onError?.(error, { channelId: candidate.channelId });
        }
      }
    }
  }
  /**
   * Resolve the facilitator signer for a channel payee / rent_payer.
   *
   * @param feePayerAddress - Live channel payee / rent_payer
   * @returns Matching signer, or undefined when not configured
   */
  resolveFeePayer(feePayerAddress) {
    if (!this.signer.getAddresses().includes(feePayerAddress)) {
      return void 0;
    }
    return this.getKitSigner(feePayerAddress);
  }
};
var ERR_SETTLEMENT_EXCEEDS_AMOUNT = "invalid_upto_svm_payload_settlement_exceeds_amount";
var ERR_UNEXPECTED_VOUCHER = "invalid_upto_svm_payload_unexpected_voucher";
var ERR_CHANNEL_ALREADY_OPEN = "invalid_upto_svm_channel_already_open";
var ERR_CHANNEL_BROADCAST = "invalid_upto_svm_channel_broadcast";
var ERR_CHANNEL_LIFETIME_EXCEEDED = "invalid_upto_svm_payload_channel_lifetime_exceeded";
var ERR_EXPIRES_AT_MISMATCH = "invalid_upto_svm_payload_expires_at_mismatch";
var ERR_SETTLEMENT_CONFIRMATION_TIMEOUT = "settlement_confirmation_timeout";
var DEFAULT_MAX_CHANNEL_LIFETIME_SECS = 3600;
var EXPIRES_AT_CLOCK_SKEW_SECS = 60;
function assertLimit(name, value, min) {
  if (value === void 0) return;
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be a safe integer >= ${min}, received ${value}`);
  }
}
var UptoSvmScheme2 = class {
  /**
   * Create the upto SVM facilitator.
   *
   * @param signer - Facilitator signer (fee payers / channel rent payers /
   *   zero-share channel payees). `getExtra` randomly selects among
   *   `signer.getAddresses()`. Must provide {@link FacilitatorSvmSigner.getSigner}.
   * @param config - Optional RPC / channel-storage configuration
   */
  constructor(signer, config = {}) {
    this.signer = signer;
    this.scheme = "upto";
    this.caipFamily = "solana:*";
    this.settlementCache = new SettlementCache();
    if (typeof signer.getSigner !== "function") {
      throw new Error(
        "UptoSvmScheme requires getSigner on the signer. Use toFacilitatorSvmSigner() which provides all required methods."
      );
    }
    this.getKitSigner = signer.getSigner.bind(signer);
    if (this.signer.getAddresses().length === 0) {
      throw new Error("UptoSvmScheme requires at least one fee payer signer");
    }
    assertLimit("maxChannelLifetimeSecs", config.maxChannelLifetimeSecs, 1);
    assertLimit("maxPriorityFeeMicroLamports", config.maxPriorityFeeMicroLamports, 0);
    assertLimit("maxComputeUnits", config.maxComputeUnits, 1);
    assertLimit("maxRequiredSignatures", config.maxRequiredSignatures, 1);
    assertLimit("computeUnitPriceMicroLamports", config.computeUnitPriceMicroLamports, 0);
    assertLimit("settleComputeUnitLimit", config.settleComputeUnitLimit, 1);
    this.config = config;
    this.channelStorage = config.channelStorage ?? new InMemoryUptoChannelStorage();
  }
  /**
   * Channel storage used for async rent cleanup.
   *
   * @returns The configured {@link UptoChannelStorage}
   */
  getChannelStorage() {
    return this.channelStorage;
  }
  /**
   * Create a {@link UptoSvmRentCleanupManager} for the given network, wired to
   * this scheme's signer pool and channel storage. Does not auto-start; call
   * `manager.start(...)` or schedule `manager.cleanup()`.
   *
   * @param network - CAIP-2 network the manager should clean up
   * @returns A rent cleanup manager for that network
   */
  createRentCleanupManager(network) {
    return new UptoSvmRentCleanupManager({
      computeUnitPriceMicroLamports: this.config.computeUnitPriceMicroLamports,
      network,
      rpcUrl: this.config.rpcUrl,
      settleComputeUnitLimit: this.config.settleComputeUnitLimit,
      rpc: this.config.rpc,
      signer: this.signer,
      storage: this.channelStorage
    });
  }
  /**
   * Advertise a randomly selected fee payer for payment-channel opens.
   * Random selection distributes load across multiple signers (same as exact).
   *
   * @param _ - The network identifier (unused)
   * @returns Extra metadata folded into the requirement's `extra`
   */
  getExtra(_) {
    const addresses = this.signer.getAddresses();
    const randomIndex = Math.floor(Math.random() * addresses.length);
    return { feePayer: addresses[randomIndex] };
  }
  /**
   * Signer addresses managed by this facilitator.
   *
   * @param _ - The network identifier (unused)
   * @returns Unique fee-payer addresses
   */
  getSigners(_) {
    return [...this.signer.getAddresses()];
  }
  /**
   * Read-only preflight: validate the open authorization without broadcasting.
   *
   * @param payload - The payment payload
   * @param requirements - The payment requirements (amount = ceiling)
   * @returns The verification response
   */
  async verify(payload, requirements) {
    const auth = await this.validateOpenAuthorization(payload, requirements, {
      rejectVoucher: true
    });
    if (!auth.ok) {
      return {
        isValid: false,
        invalidReason: auth.failure.reason,
        invalidMessage: auth.failure.message,
        payer: auth.failure.payer
      };
    }
    return { isValid: true, invalidReason: void 0, payer: auth.ctx.p.from };
  }
  /**
   * Deposit (open channel) or claim (settle_and_seal + distribute).
   *
   * Discrimination (no settle phase on the wire):
   * - no `voucherSignature` and `requirements.amount === payload.maxAmount` → deposit
   * - `voucherSignature` present → claim against the open channel
   *
   * @param payload - The payment payload
   * @param requirements - Deposit: amount = ceiling; claim: amount = actual charge
   * @returns The settlement response
   */
  async settle(payload, requirements) {
    const raw = payload.payload;
    if (!isUptoSvmPayload(raw)) {
      return this.settleFailure(payload, "unsupported_payload_type", "");
    }
    const p = raw;
    if (payload.accepted.scheme !== "upto" || requirements.scheme !== "upto") {
      return this.settleFailure(payload, "unsupported_scheme", p.from);
    }
    if (payload.accepted.network !== requirements.network) {
      return this.settleFailure(payload, "network_mismatch", p.from);
    }
    let actual;
    let payloadMaxAmount;
    try {
      actual = BigInt(requirements.amount);
      payloadMaxAmount = BigInt(p.maxAmount);
    } catch {
      return this.settleFailure(payload, "invalid_upto_svm_payload_amount", p.from);
    }
    if (actual < 0n) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_amount", p.from);
    }
    if (actual > payloadMaxAmount) {
      return this.settleFailure(payload, ERR_SETTLEMENT_EXCEEDS_AMOUNT, p.from);
    }
    const hasVoucher = Object.prototype.hasOwnProperty.call(raw, "voucherSignature");
    if (hasVoucher) {
      return this.settleClaim(payload, requirements, p, actual, payloadMaxAmount);
    }
    if (actual === payloadMaxAmount) {
      return this.settleDeposit(payload, requirements);
    }
    return this.settleFailure(payload, "invalid_upto_svm_payload_missing_voucher", p.from);
  }
  /**
   * Deposit path: validate open authorization, then sim → broadcast → bind.
   * Rejects when the channel already exists (one request, one open).
   *
   * @param payload - The payment payload
   * @param requirements - Requirements with amount = authorized ceiling
   * @returns Deposit settlement response
   */
  async settleDeposit(payload, requirements) {
    const auth = await this.validateOpenAuthorization(payload, requirements, {
      rejectVoucher: true
    });
    if (!auth.ok) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: auth.failure.reason,
        errorMessage: auth.failure.message,
        payer: auth.failure.payer
      };
    }
    const { p, channelConfig, feePayerSigner, maxAmount, tokenProgram } = auth.ctx;
    const feePayer = channelConfig.feePayer;
    const rpc = this.config.rpc ?? createRpcClient(requirements.network, this.config.rpcUrl);
    if (await channelExists(rpc, p.channelId)) {
      return this.settleFailure(payload, ERR_CHANNEL_ALREADY_OPEN, p.from);
    }
    const depositKey = `upto:deposit:${requirements.network}:${p.channelId}`;
    if (this.settlementCache.isDuplicate(depositKey)) {
      return this.settleFailure(payload, "duplicate_settlement", p.from);
    }
    try {
      await simulateOpenSettleDistribute(feePayerSigner, rpc, {
        openTransactionBase64: p.openTransaction,
        channel: {
          channelId: p.channelId,
          mint: requirements.asset,
          network: requirements.network,
          payee: feePayer,
          payer: p.from,
          rentPayer: feePayer,
          splits: channelConfig.splits,
          tokenProgram
        }
      });
    } catch (error) {
      this.settlementCache.delete(depositKey);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "invalid_upto_svm_settlement_simulation",
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
    try {
      await this.upsertChannelStorageOrFail({
        channelId: p.channelId,
        network: requirements.network,
        payTo: requirements.payTo,
        tokenProgram,
        expiresAt: p.expiresAt
      });
    } catch (error) {
      this.settlementCache.delete(depositKey);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: ERR_CHANNEL_BROADCAST,
        errorMessage: `failed to durably index the channel before broadcast: ${error instanceof Error ? error.message : String(error)}`,
        payer: p.from
      };
    }
    let openSignature;
    try {
      openSignature = await broadcastOpen(
        this.signer,
        feePayer,
        requirements.network,
        p.openTransaction
      );
    } catch (error) {
      this.settlementCache.delete(depositKey);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: ERR_CHANNEL_BROADCAST,
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
    try {
      await fetchAndVerifyOpenChannel(rpc, p.channelId, {
        authorizedSigner: channelConfig.receiverAuthorizer,
        deposit: maxAmount,
        gracePeriod: channelConfig.withdrawDelay,
        mint: requirements.asset,
        payee: feePayer,
        payer: p.from,
        rentPayer: feePayer,
        splits: channelConfig.splits
      });
    } catch (error) {
      this.settlementCache.delete(depositKey);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "invalid_upto_svm_channel_state",
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
    return {
      success: true,
      transaction: openSignature,
      network: requirements.network,
      amount: maxAmount.toString(),
      payer: p.from
    };
  }
  /**
   * Claim path: re-bind the open channel, verify the voucher, then
   * settle_and_seal + distribute.
   *
   * @param payload - The payment payload
   * @param requirements - Requirements with amount = actual charge
   * @param p - Typed upto payload
   * @param actual - Actual charge in atomic units
   * @param payloadMaxAmount - Signed ceiling from the payload
   * @returns Claim settlement response
   */
  async settleClaim(payload, requirements, p, actual, payloadMaxAmount) {
    if (typeof p.voucherSignature !== "string" || p.voucherSignature.length === 0) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_missing_voucher", p.from);
    }
    let channelConfig;
    try {
      channelConfig = resolveUptoSvmPaymentChannelConfig(requirements);
    } catch (error) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "invalid_upto_svm_payment_requirements",
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
    if (p.authorizedSigner !== channelConfig.receiverAuthorizer) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_receiver_authorizer", p.from);
    }
    const feePayerSigner = this.resolveFeePayer(channelConfig.feePayer);
    if (!feePayerSigner) {
      return this.settleFailure(payload, "facilitator_mismatch", p.from);
    }
    const now = Math.floor(Date.now() / 1e3);
    if (now < p.validAfter) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_not_yet_active", p.from);
    }
    if (p.expiresAt === 0 || now >= p.expiresAt) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_expired", p.from);
    }
    const expiresAt = BigInt(p.expiresAt);
    const voucherMessage = encodeVoucherMessageBytes({
      channelId: p.channelId,
      cumulativeAmount: actual,
      expiresAt
    });
    let voucherOk;
    try {
      voucherOk = await verifyVoucherSignature2({
        message: voucherMessage,
        signatureBase58: p.voucherSignature,
        signerBase58: p.authorizedSigner
      });
    } catch {
      return this.settleFailure(payload, "invalid_upto_svm_payload_voucher_signature", p.from);
    }
    if (!voucherOk) {
      return this.settleFailure(payload, "invalid_upto_svm_payload_voucher_signature", p.from);
    }
    let tokenProgram;
    try {
      tokenProgram = resolveTokenProgram(requirements);
    } catch {
      return this.settleFailure(payload, "invalid_upto_svm_payment_requirements", p.from);
    }
    const network = requirements.network;
    const rpc = this.config.rpc ?? createRpcClient(network, this.config.rpcUrl);
    let channel;
    try {
      channel = await fetchAndVerifyOpenChannel(rpc, p.channelId, {
        authorizedSigner: channelConfig.receiverAuthorizer,
        deposit: payloadMaxAmount,
        gracePeriod: channelConfig.withdrawDelay,
        mint: requirements.asset,
        payee: channelConfig.feePayer,
        payer: p.from,
        rentPayer: channelConfig.feePayer,
        splits: channelConfig.splits
      });
    } catch (error) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "invalid_upto_svm_channel_state",
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
    const settlementKey = `upto:${network}:${p.channelId}`;
    if (this.settlementCache.isDuplicate(settlementKey)) {
      return this.settleFailure(payload, "duplicate_settlement", p.from);
    }
    try {
      const settle = buildSettleAndSealInstructions({
        channelId: channel.channelId,
        payeeSigner: feePayerSigner,
        voucher: actual > 0n ? {
          authorizedSigner: channel.authorizedSigner,
          cumulativeAmount: actual,
          expiresAt,
          signatureBase58: p.voucherSignature
        } : void 0
      });
      const distribute = await buildDistributeInstruction({
        channelId: channel.channelId,
        mint: channel.mint,
        network,
        payee: channel.payee,
        payer: channel.payer,
        rentPayer: channel.rentPayer,
        splits: channel.splits,
        tokenProgram
      });
      const instructions = [...settle, distribute];
      const signature = await submitSettle(feePayerSigner, rpc, instructions, {
        computeUnitLimit: this.config.settleComputeUnitLimit,
        computeUnitPriceMicroLamports: this.config.computeUnitPriceMicroLamports
      });
      await this.upsertChannelStorage("settle", {
        channelId: channel.channelId,
        network,
        payTo: requirements.payTo,
        tokenProgram,
        expiresAt: p.expiresAt
      });
      return {
        success: true,
        transaction: signature,
        network,
        amount: actual.toString(),
        payer: channel.payer
      };
    } catch (error) {
      if (error instanceof SettlementConfirmationTimeoutError) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: ERR_SETTLEMENT_CONFIRMATION_TIMEOUT,
          errorMessage: error.message,
          payer: p.from
        };
      }
      this.settlementCache.delete(settlementKey);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "transaction_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        payer: p.from
      };
    }
  }
  /**
   * Static open-authorization checks shared by verify and deposit settle.
   * Never broadcasts or mutates chain state.
   *
   * @param payload - The payment payload
   * @param requirements - Payment requirements (amount must equal ceiling)
   * @param options - Validation options
   * @param options.rejectVoucher - Reject payloads that include `voucherSignature`
   * @returns Open auth context or a structured failure
   */
  async validateOpenAuthorization(payload, requirements, options) {
    const raw = payload.payload;
    if (!isUptoSvmPayload(raw)) {
      return {
        ok: false,
        failure: { reason: "unsupported_payload_type", payer: "" }
      };
    }
    const p = raw;
    if (payload.accepted.scheme !== "upto" || requirements.scheme !== "upto") {
      return { ok: false, failure: { reason: "unsupported_scheme", payer: p.from } };
    }
    if (payload.accepted.network !== requirements.network) {
      return { ok: false, failure: { reason: "network_mismatch", payer: p.from } };
    }
    if (options.rejectVoucher && Object.prototype.hasOwnProperty.call(raw, "voucherSignature")) {
      return { ok: false, failure: { reason: ERR_UNEXPECTED_VOUCHER, payer: p.from } };
    }
    let channelConfig;
    try {
      channelConfig = resolveUptoSvmPaymentChannelConfig(requirements);
    } catch (error) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payment_requirements",
          message: error instanceof Error ? error.message : String(error),
          payer: p.from
        }
      };
    }
    const feePayer = channelConfig.feePayer;
    const feePayerSigner = this.resolveFeePayer(feePayer);
    if (!feePayerSigner) {
      return { ok: false, failure: { reason: "facilitator_mismatch", payer: p.from } };
    }
    const receiverAuthorizer = channelConfig.receiverAuthorizer;
    if (p.authorizedSigner !== receiverAuthorizer) {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_receiver_authorizer", payer: p.from }
      };
    }
    let maxAmount;
    let deposit;
    let requiredAmount;
    try {
      maxAmount = BigInt(p.maxAmount);
      deposit = BigInt(p.deposit);
      requiredAmount = BigInt(requirements.amount);
    } catch {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_amount", payer: p.from }
      };
    }
    if (maxAmount !== requiredAmount) {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_amount_mismatch", payer: p.from }
      };
    }
    if (deposit !== maxAmount) {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_deposit_not_ceiling", payer: p.from }
      };
    }
    const rpc = this.config.rpc ?? createRpcClient(requirements.network, this.config.rpcUrl);
    let openSlot;
    let recentSlot;
    let nonce;
    try {
      openSlot = parseU64(p.openSlot, "payload.openSlot");
      nonce = parseU64(p.nonce, "payload.nonce");
      if (requirements.extra?.recentSlot !== void 0 && requirements.extra?.recentSlot !== null) {
        recentSlot = parseU64(
          requirements.extra.recentSlot,
          "requirements.extra.recentSlot"
        );
      } else {
        recentSlot = await rpc.getSlot({ commitment: SLOT_COMMITMENT }).send();
      }
    } catch {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_channel_seed", payer: p.from }
      };
    }
    const now = Math.floor(Date.now() / 1e3);
    if (now < p.validAfter) {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_not_yet_active", payer: p.from }
      };
    }
    if (p.expiresAt === 0 || now >= p.expiresAt) {
      return {
        ok: false,
        failure: { reason: "invalid_upto_svm_payload_expired", payer: p.from }
      };
    }
    const maxTimeoutSeconds = requirements.maxTimeoutSeconds;
    if (!Number.isSafeInteger(maxTimeoutSeconds) || maxTimeoutSeconds < 1) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payment_requirements",
          message: `maxTimeoutSeconds must be a safe integer >= 1, received ${maxTimeoutSeconds}`,
          payer: p.from
        }
      };
    }
    const maxChannelLifetimeSecs = this.config.maxChannelLifetimeSecs ?? DEFAULT_MAX_CHANNEL_LIFETIME_SECS;
    if (maxTimeoutSeconds > maxChannelLifetimeSecs) {
      return {
        ok: false,
        failure: {
          reason: ERR_CHANNEL_LIFETIME_EXCEEDED,
          message: `maxTimeoutSeconds ${maxTimeoutSeconds} exceeds maxChannelLifetimeSecs ${maxChannelLifetimeSecs}`,
          payer: p.from
        }
      };
    }
    if (p.expiresAt > now + maxChannelLifetimeSecs + EXPIRES_AT_CLOCK_SKEW_SECS) {
      return {
        ok: false,
        failure: {
          reason: ERR_CHANNEL_LIFETIME_EXCEEDED,
          message: `expiresAt remaining ${p.expiresAt - now}s exceeds maxChannelLifetimeSecs ${maxChannelLifetimeSecs}`,
          payer: p.from
        }
      };
    }
    if (p.expiresAt > now + maxTimeoutSeconds + EXPIRES_AT_CLOCK_SKEW_SECS) {
      return {
        ok: false,
        failure: {
          reason: ERR_EXPIRES_AT_MISMATCH,
          message: `expiresAt ${p.expiresAt} exceeds now + maxTimeoutSeconds (${now + maxTimeoutSeconds})`,
          payer: p.from
        }
      };
    }
    if (!validateSvmAddress(p.from)) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payload_payer_mismatch",
          message: `payload.from ${p.from} is not a valid address`,
          payer: p.from
        }
      };
    }
    if (!validateSvmAddress(requirements.asset)) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payment_requirements",
          message: `requirements.asset ${requirements.asset} is not a valid mint address`,
          payer: p.from
        }
      };
    }
    for (const [field, value] of [
      ["feePayer", feePayer],
      ["receiverAuthorizer", receiverAuthorizer]
    ]) {
      if (!validateSvmAddress(value)) {
        return {
          ok: false,
          failure: {
            reason: "invalid_upto_svm_payment_requirements",
            message: `extra.${field} ${value} is not a valid address`,
            payer: p.from
          }
        };
      }
    }
    let tokenProgram;
    try {
      tokenProgram = resolveTokenProgram(requirements);
    } catch (error) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payment_requirements",
          message: error instanceof Error ? error.message : String(error),
          payer: p.from
        }
      };
    }
    try {
      const open = await verifyOpenTransaction(p.openTransaction, {
        authorizedSigner: receiverAuthorizer,
        feePayer,
        from: p.from,
        maxCap: maxAmount,
        maxComputeUnits: this.config.maxComputeUnits,
        maxPriorityFeeMicroLamports: this.config.maxPriorityFeeMicroLamports,
        maxRequiredSignatures: this.config.maxRequiredSignatures,
        memo: resolveUptoSvmMemo(requirements.extra),
        mint: requirements.asset,
        openSlot,
        payee: feePayer,
        recentSlot,
        recipients: channelConfig.splits,
        tokenProgram,
        withdrawDelay: channelConfig.withdrawDelay
      });
      if (open.channelId !== p.channelId) {
        return {
          ok: false,
          failure: {
            reason: "invalid_upto_svm_payload_channel_id",
            message: `open channel ${open.channelId} != payload.channelId ${p.channelId}`,
            payer: p.from
          }
        };
      }
      if (open.salt !== nonce) {
        return {
          ok: false,
          failure: {
            reason: "invalid_upto_svm_payload_nonce",
            message: `open salt ${open.salt} != payload.nonce ${p.nonce}`,
            payer: p.from
          }
        };
      }
      if (open.payer !== p.from) {
        return {
          ok: false,
          failure: {
            reason: "invalid_upto_svm_payload_payer_mismatch",
            message: `open payer ${open.payer} != payload.from ${p.from}`,
            payer: p.from
          }
        };
      }
    } catch (error) {
      return {
        ok: false,
        failure: {
          reason: "invalid_upto_svm_payload_open_transaction",
          message: error instanceof Error ? error.message : String(error),
          payer: p.from
        }
      };
    }
    return {
      ok: true,
      ctx: { p, channelConfig, feePayerSigner, maxAmount, tokenProgram }
    };
  }
  /**
   * Build a failed settle response.
   *
   * @param payload - Payment payload (for network)
   * @param errorReason - Error reason code
   * @param payer - Payer address when known
   * @returns Failed settle response
   */
  settleFailure(payload, errorReason, payer) {
    return {
      success: false,
      network: payload.accepted.network,
      transaction: "",
      errorReason,
      payer
    };
  }
  /**
   * Resolve the configured signer for a fee-payer address.
   *
   * @param feePayerAddress - Fee-payer address from the challenge
   * @returns The matching kit signer, or undefined when not managed
   */
  resolveFeePayer(feePayerAddress) {
    if (!this.signer.getAddresses().includes(feePayerAddress)) {
      return void 0;
    }
    return this.getKitSigner(feePayerAddress);
  }
  /**
   * Upsert a channel into rent-cleanup storage after settlement is already
   * confirmed onchain. Failures go to
   * {@link UptoSvmFacilitatorConfig.onStorageError} and never propagate: a
   * charged payment must never turn into a failure over bookkeeping.
   *
   * @param phase - Whether verify or settle succeeded before the upsert
   * @param fields - Channel facts retained for cleanup (payTo included)
   */
  async upsertChannelStorage(phase, fields) {
    try {
      await this.channelStorage.upsert({
        ...fields,
        firstSeenAt: Date.now()
      });
    } catch (error) {
      const context = { channelId: fields.channelId, phase };
      if (this.config.onStorageError) {
        this.config.onStorageError(error, context);
      } else {
        console.warn(`[x402] upto svm: channel storage upsert failed after ${phase}`, {
          channelId: fields.channelId,
          error
        });
      }
    }
  }
  /**
   * Upsert a channel and rethrow on storage failure. Used only for the
   * pre-broadcast deposit index, where nothing has reached the chain yet and
   * a durable record is the only way rent cleanup can ever find the channel.
   *
   * @param fields - Channel facts retained for cleanup (payTo included)
   */
  async upsertChannelStorageOrFail(fields) {
    try {
      await this.channelStorage.upsert({
        ...fields,
        firstSeenAt: Date.now()
      });
    } catch (error) {
      this.config.onStorageError?.(error, { channelId: fields.channelId, phase: "settle" });
      throw error;
    }
  }
};

// src/coin.ts
function resolveCoin(amount, stablecoins) {
  return amount.primaryCoin() ?? stablecoins[0] ?? "USDC";
}
function requireMint(coin, mint, network) {
  if (!mint) throw new ConfigurationError(`No ${coin} mint known for ${network}.`);
  return mint;
}

// src/protocol.ts
function toNetwork(value) {
  switch (value) {
    case "devnet":
      return "solana_devnet";
    case "localnet":
      return "solana_localnet";
    case "mainnet":
    case "mainnet-beta":
      return "solana_mainnet";
    default:
      return value;
  }
}
function toSolanaNetwork(network) {
  switch (network) {
    case "solana_devnet":
      return "devnet";
    case "solana_localnet":
      return "localnet";
    case "solana_mainnet":
      return "mainnet";
  }
}
function caip2(network) {
  return network === "solana_devnet" ? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" : "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
}

// src/adapters/x402-shared.ts
import { getBase64Codec as getBase64Codec6, getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder6, getTransactionDecoder as getTransactionDecoder6 } from "@solana/kit";
function x402PaymentHeader(request) {
  return request.headers.get("x-payment") ?? request.headers.get("payment-signature") ?? void 0;
}
function errorMessage3(error) {
  return error instanceof Error ? error.message : void 0;
}
function rejectLegacyTransaction(transactionBase64, code) {
  if (typeof transactionBase64 !== "string") return;
  let message;
  try {
    const decoded = getTransactionDecoder6().decode(getBase64Codec6().encode(transactionBase64));
    message = getCompiledTransactionMessageDecoder6().decode(decoded.messageBytes);
  } catch {
    return;
  }
  try {
    assertVersionedTransactionMessage(message);
  } catch (error) {
    throw new InvalidProofError(code, errorMessage3(error));
  }
}

// src/adapters/x402-upto.ts
var PAYMENT_RESPONSE_HEADER = "x-payment-response";
var PAYMENT_REQUIRED_HEADER = "payment-required";
var X402_VERSION = 2;
var MAX_TIMEOUT_SECONDS = 300;
var DEFAULT_WITHDRAW_DELAY_SECONDS = 900;
var Charge = class {
  #amount;
  /** The authorized maximum for this request, in base units. */
  maxBaseUnits;
  constructor(maxBaseUnits) {
    this.maxBaseUnits = maxBaseUnits;
  }
  /** Record the actual amount consumed (base units). Values above the ceiling are clamped; negatives floor to 0. */
  charge(baseUnits) {
    const value = typeof baseUnits === "bigint" ? baseUnits : BigInt(Math.trunc(baseUnits));
    this.#amount = value < 0n ? 0n : value > this.maxBaseUnits ? this.maxBaseUnits : value;
  }
  /** The amount to settle (base units): the clamped charge, or `0` if never set. */
  settledBaseUnits() {
    return this.#amount ?? 0n;
  }
};
var X402Upto = class {
  #facilitator;
  #network;
  #feePayer;
  #receiverAuthorizer;
  #signer;
  #recipient;
  #rpcUrl;
  #stablecoins;
  constructor(config) {
    this.#network = caip2(config.network);
    this.#feePayer = config.operator.signer.pubkey;
    this.#receiverAuthorizer = config.operator.signer.pubkey;
    this.#signer = config.operator.signer;
    this.#recipient = config.operator.recipient;
    this.#rpcUrl = config.rpcUrl;
    this.#stablecoins = config.stablecoins;
    this.#facilitator = new x402Facilitator().register(
      this.#network,
      new UptoSvmScheme2(
        toFacilitatorSvmSigner(config.operator.signer.signer, { defaultRpcUrl: config.rpcUrl }),
        { rpcUrl: config.rpcUrl }
      )
    );
  }
  /** Whether `request` carries an x402 payment credential. */
  detect(request) {
    return x402PaymentHeader(request) !== void 0;
  }
  /**
   * The 402 challenge headers for a route capped at `maxPrice`. Pass the
   * entries from {@link accepts} to reuse one server-enriched requirement
   * (one `getLatestBlockhash` round-trip) for both the header and the body.
   */
  async challengeHeaders(maxPrice, request, accepts) {
    const paymentRequired = {
      accepts: [...accepts ?? await this.accepts(maxPrice)],
      // x402 v2 requires an exact match with the response's absolute URL.
      resource: { url: request.url },
      x402Version: X402_VERSION
    };
    return { [PAYMENT_REQUIRED_HEADER]: encodePaymentRequiredHeader(paymentRequired) };
  }
  /**
   * The `accepts[]` entries for the 402 JSON body — the same server-enriched
   * requirement (`extra.recentBlockhash` + `extra.recentSlot`) the header
   * carries, so body-based `upto` clients can build the channel open too.
   */
  async accepts(maxPrice) {
    return [await this.#challengeRequirements(maxPrice)];
  }
  /**
   * Verify the authorization and broadcast the channel open (escrowing the
   * ceiling before the resource is served).
   *
   * In `@x402/svm` >= 2.23 the facilitator's `verify()` is a read-only
   * preflight — the open broadcast moved to `settle()`'s deposit path
   * (no `voucherSignature`, `requirements.amount === payload.maxAmount`).
   * `settle()` runs the same authorization checks `verify()` does before
   * touching the network, so calling it directly here does not skip any
   * validation — it is the only path that actually escrows the ceiling.
   *
   * @throws {InvalidProofError} when the authorization or the deposit
   *   broadcast fails.
   */
  async verifyOpen(request, maxPrice) {
    const header = x402PaymentHeader(request);
    if (!header) throw new InvalidProofError("missing_x402_payment_header");
    let payload;
    try {
      payload = decodePaymentSignatureHeader(header);
    } catch (error) {
      throw new InvalidProofError("invalid_x402_payment_header", errorMessage3(error));
    }
    rejectLegacyTransaction(
      payload.payload?.openTransaction,
      "invalid_upto_svm_payload_open_transaction"
    );
    const recentSlot = await this.#observeRecentSlot();
    this.#assertOpenSlotBoundToChallenge(payload, recentSlot);
    const requirements = this.#requirements(maxPrice, recentSlot);
    const settled = await this.#facilitator.settle(payload, requirements);
    if (!settled.success) {
      throw new InvalidProofError(settled.errorReason ?? "invalid_proof", settled.errorMessage);
    }
    return { maxBaseUnits: BigInt(requirements.amount), payer: settled.payer ?? "", payload, requirements };
  }
  /**
   * Re-observe the current slot the way {@link X402Upto.accepts} mints it for
   * the challenge: one `getLatestBlockhash`, whose response context carries
   * the slot the blockhash was produced at. `undefined` when the RPC read
   * fails — callers then skip the window check (the facilitator's channel-PDA
   * bind still holds and the program enforces the window at broadcast).
   */
  async #observeRecentSlot() {
    try {
      const { context } = await createSolanaRpc2(this.#rpcUrl).getLatestBlockhash().send();
      return BigInt(context.slot);
    } catch {
      return void 0;
    }
  }
  /**
   * Enforce `openSlot <= recentSlot` and `recentSlot - openSlot <=
   * OPEN_SLOT_WINDOW` against the re-observed challenged recentSlot.
   *
   * @throws {InvalidProofError} when the openSlot was not built against a
   *   fresh challenge.
   */
  #assertOpenSlotBoundToChallenge(payload, recentSlot) {
    const raw = payload.payload;
    if (!raw || typeof raw.openSlot !== "string" || !/^\d+$/.test(raw.openSlot)) {
      throw new InvalidProofError(
        "invalid_upto_svm_payload_channel_seed",
        "payload.openSlot must be a u64 decimal string"
      );
    }
    const openSlot = BigInt(raw.openSlot);
    if (recentSlot === void 0) return;
    if (openSlot > recentSlot) {
      throw new InvalidProofError(
        "invalid_upto_svm_payload_open_slot",
        `open openSlot ${openSlot} is ahead of the challenged recentSlot ${recentSlot}`
      );
    }
    if (recentSlot - openSlot > OPEN_SLOT_WINDOW2) {
      throw new InvalidProofError(
        "invalid_upto_svm_payload_open_slot",
        `open openSlot ${openSlot} is outside the ${OPEN_SLOT_WINDOW2}-slot freshness window of the challenged recentSlot ${recentSlot}`
      );
    }
  }
  /**
   * Settle the metered amount (`actualBaseUnits`, clamped to the ceiling) against
   * a verified open: receiver-authorizer voucher, fee-payer-signed settle-and-seal,
   * refund the remainder.
   *
   * @throws {InvalidProofError} when settlement fails.
   */
  async settle(verified, actualBaseUnits) {
    const actual = actualBaseUnits > verified.maxBaseUnits ? verified.maxBaseUnits : actualBaseUnits;
    const payload = parseUptoPayload(verified.payload);
    const voucherSignature = await this.#signVoucher(payload.channelId, actual, BigInt(payload.expiresAt));
    const claimPayload = {
      ...verified.payload,
      payload: { ...verified.payload.payload, voucherSignature }
    };
    const claimRequirements = { ...verified.requirements, amount: actual.toString() };
    const settled = await this.#facilitator.settle(claimPayload, claimRequirements);
    if (!settled.success) {
      throw new InvalidProofError(settled.errorReason ?? "transaction_failed", settled.errorMessage);
    }
    const settlement = {
      amount: settled.amount ?? actual.toString(),
      network: verified.requirements.network,
      payer: settled.payer ?? payload.from,
      success: true,
      transaction: settled.transaction
    };
    return {
      amount: settlement.amount,
      settlementHeaders: { [PAYMENT_RESPONSE_HEADER]: encodePaymentResponseHeader(settlement) },
      transaction: settlement.transaction
    };
  }
  async #signVoucher(channelId, cumulativeAmount, expiresAt) {
    const message = encodeVoucherMessageBytes2({ channelId, cumulativeAmount, expiresAt });
    const signature = await this.#signer.sign(message);
    return getBase58Decoder2().decode(signature);
  }
  /**
   * The route's pinned requirements. `recentSlot`, when passed, is the
   * challenged slot the facilitator window-checks `payload.openSlot` against;
   * omitting it makes the facilitator read its own `finalized` slot, which
   * lags the challenge and rejects a fresh open.
   */
  #requirements(maxPrice, recentSlot) {
    const coin = resolveCoin(maxPrice, this.#stablecoins);
    const mint = requireMint(coin, resolveStablecoinMint2(coin, this.#network), this.#network);
    return {
      amount: maxPrice.baseUnits().toString(),
      asset: mint,
      extra: {
        feePayer: this.#feePayer,
        receiverAuthorizer: this.#receiverAuthorizer,
        ...recentSlot !== void 0 && { recentSlot: recentSlot.toString() },
        tokenProgram: getStablecoinTokenProgram(mint, this.#network),
        withdrawDelay: DEFAULT_WITHDRAW_DELAY_SECONDS
      },
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      network: this.#network,
      payTo: this.#recipient,
      scheme: "upto"
    };
  }
  /**
   * The challenge requirements with a server-fetched recent blockhash and
   * current slot (`recentSlot`) in `extra` - so the client can sign the
   * channel-open without its own RPC round-trip (mirroring MPP). The slot
   * comes from the same blockhash response's context and becomes the
   * channel `openSlot` PDA seed, which clients must take from the
   * challenge — so a bare offer without it is unusable. A failed fetch
   * therefore throws (the caller fails the challenge or omits the `upto`
   * offer) instead of advertising requirements no client can act on.
   */
  async #challengeRequirements(maxPrice) {
    const base = this.#requirements(maxPrice);
    let context, value;
    try {
      ({ context, value } = await createSolanaRpc2(this.#rpcUrl).getLatestBlockhash().send());
    } catch (error) {
      throw new Error(
        `x402 upto challenge requires extra.recentBlockhash/recentSlot; getLatestBlockhash failed: ${errorMessage3(error)}`
      );
    }
    return {
      ...base,
      extra: {
        ...base.extra,
        lastValidBlockHeight: value.lastValidBlockHeight.toString(),
        recentBlockhash: value.blockhash,
        recentSlot: context.slot.toString()
      }
    };
  }
};
function parseUptoPayload(payload) {
  const raw = payload.payload;
  if (!raw || typeof raw.channelId !== "string" || typeof raw.from !== "string" || typeof raw.expiresAt !== "number") {
    throw new InvalidProofError("invalid_upto_payload");
  }
  return { channelId: raw.channelId, expiresAt: raw.expiresAt, from: raw.from };
}

// src/price.ts
var STABLECOINS = ["CASH", "PYUSD", "USDC", "USDG", "USDT"];
var AMOUNT_PATTERN = /^[0-9]+(?:\.[0-9]{1,6})?$/;
var MICRO = 1000000n;
function toMicro(amount) {
  if (!AMOUNT_PATTERN.test(amount)) {
    throw new ConfigurationError(
      `Invalid amount "${amount}". Use a non-negative decimal string with at most 6 decimal places.`
    );
  }
  const [whole = "0", frac = ""] = amount.split(".");
  return BigInt(whole) * MICRO + BigInt(`${frac}000000`.slice(0, 6));
}
function fromMicro(micro) {
  const whole = micro / MICRO;
  const frac = (micro % MICRO).toString().padStart(6, "0").replace(/0+$/, "");
  return frac === "" ? `${whole}` : `${whole}.${frac}`;
}
var Price = class _Price {
  /** Canonical decimal string, e.g. `"0.10"`. */
  amount;
  currency;
  /** Ordered settlement preference. Empty means "inherit from config". */
  settlements;
  constructor(currency, amount, settlements) {
    this.amount = fromMicro(toMicro(amount));
    this.currency = currency;
    this.settlements = Object.freeze([...settlements]);
    Object.freeze(this);
  }
  /** Creates a EUR price. */
  static eur(amount, ...settlements) {
    return new _Price("EUR", amount, settlements);
  }
  /** Creates a GBP price. */
  static gbp(amount, ...settlements) {
    return new _Price("GBP", amount, settlements);
  }
  /** Creates a USD price. */
  static usd(amount, ...settlements) {
    return new _Price("USD", amount, settlements);
  }
  /** Wire-form decimal string (alias for {@link Price.amount}). */
  amountString() {
    return this.amount;
  }
  /**
   * The amount in on-chain base units.
   *
   * @param decimals - Token decimals of the settlement asset (6 for all supported stablecoins).
   */
  baseUnits(decimals = 6) {
    const micro = toMicro(this.amount);
    if (decimals === 6) return micro;
    return decimals > 6 ? micro * 10n ** BigInt(decimals - 6) : micro / 10n ** BigInt(6 - decimals);
  }
  /** Compares two same-currency prices. @throws {MixedCurrenciesError} on currency mismatch. */
  isGreaterThan(other) {
    this.#assertSameCurrency(other);
    return toMicro(this.amount) > toMicro(other.amount);
  }
  /** Sums two same-currency prices. @throws {MixedCurrenciesError} on currency mismatch. */
  plus(other) {
    this.#assertSameCurrency(other);
    return new _Price(this.currency, fromMicro(toMicro(this.amount) + toMicro(other.amount)), this.settlements);
  }
  /** First settlement preference, if one was set explicitly. */
  primaryCoin() {
    return this.settlements[0];
  }
  /**
   * Subtracts a same-currency price.
   *
   * @throws {MixedCurrenciesError} on currency mismatch or negative result.
   */
  minus(other) {
    this.#assertSameCurrency(other);
    const result = toMicro(this.amount) - toMicro(other.amount);
    if (result < 0n) {
      throw new ConfigurationError(`Cannot subtract ${other.amount} from ${this.amount}: negative result.`);
    }
    return new _Price(this.currency, fromMicro(result), this.settlements);
  }
  /** Copy with a different amount, same currency and settlements. */
  withAmount(amount) {
    return new _Price(this.currency, amount, this.settlements);
  }
  #assertSameCurrency(other) {
    if (other.currency !== this.currency) {
      throw new MixedCurrenciesError(`Cannot combine ${this.currency} with ${other.currency}.`);
    }
  }
};
function usd(amount, ...settlements) {
  return Price.usd(amount, ...settlements);
}
function eur(amount, ...settlements) {
  return Price.eur(amount, ...settlements);
}
function gbp(amount, ...settlements) {
  return Price.gbp(amount, ...settlements);
}

// src/signer.ts
import {
  createMemorySignerFromBytes,
  createMemorySignerFromKeyPair,
  createMemorySignerFromKeypairFile,
  createMemorySignerFromPrivateKeyString
} from "@solana/keychain-memory";
import {
  createSignableMessage as createSignableMessage2,
  generateKeyPair
} from "@solana/kit";
var DEMO_SECRET_BYTES = new Uint8Array([
  26,
  61,
  117,
  192,
  9,
  232,
  24,
  51,
  89,
  135,
  105,
  182,
  47,
  9,
  83,
  244,
  11,
  214,
  85,
  170,
  227,
  83,
  170,
  26,
  55,
  129,
  58,
  114,
  89,
  160,
  195,
  51,
  138,
  209,
  127,
  35,
  54,
  41,
  202,
  166,
  199,
  166,
  97,
  238,
  181,
  63,
  254,
  185,
  45,
  16,
  174,
  102,
  250,
  198,
  30,
  191,
  232,
  236,
  147,
  167,
  41,
  178,
  151,
  26
]);
var HEX_PATTERN = /^[0-9a-fA-F]{128}$/;
function wrap(signer, options = {}) {
  return Object.freeze({
    isDemo: options.isDemo ?? false,
    isFeePayer: options.isFeePayer ?? true,
    pubkey: signer.address,
    async sign(message) {
      const [dictionary] = await signer.signMessages([createSignableMessage2(message)]);
      const signature = dictionary?.[signer.address];
      if (!signature) throw new InvalidKeyError(`Signer ${signer.address} returned no signature.`);
      return new Uint8Array(signature);
    },
    signer
  });
}
async function rethrowingInvalidKey(build) {
  try {
    return await build();
  } catch (error) {
    if (error instanceof InvalidKeyError) throw error;
    throw new InvalidKeyError(error instanceof Error ? error.message : String(error), { cause: error });
  }
}
var demoSigner;
var Signer = {
  /** From a base58-encoded 64-byte secret (Phantom/Solflare export). */
  async base58(secret) {
    return wrap(await rethrowingInvalidKey(() => createMemorySignerFromPrivateKeyString(secret)));
  },
  /** From raw secret bytes: 64-byte Solana CLI keypair or 32-byte Ed25519 seed. */
  async bytes(secret) {
    const bytes = secret instanceof Uint8Array ? secret : new Uint8Array(secret);
    return wrap(await rethrowingInvalidKey(() => createMemorySignerFromBytes(bytes)));
  },
  /**
   * The package-shipped demo keypair, cached per process. Warns once;
   * refused on mainnet at configure time.
   */
  demo() {
    demoSigner ??= (async () => {
      console.warn("[pay-kit] Using the shared demo signer. It is public and for local development only.");
      return wrap(await createMemorySignerFromBytes(DEMO_SECRET_BYTES), { isDemo: true });
    })();
    return demoSigner;
  },
  /**
   * From an environment variable, auto-detecting JSON-array, hex, or base58
   * encoding. Returns `undefined` when the variable is unset or empty.
   */
  async env(name) {
    const value = process.env[name]?.trim();
    if (!value) return void 0;
    if (HEX_PATTERN.test(value)) return await Signer.hex(value);
    return wrap(await rethrowingInvalidKey(() => createMemorySignerFromPrivateKeyString(value)));
  },
  /** From a Solana CLI keypair JSON file. */
  async file(path) {
    return wrap(await rethrowingInvalidKey(() => createMemorySignerFromKeypairFile(path)));
  },
  /**
   * Wraps an existing Keychain (or any kit) signer — the bridge to remote
   * backends such as AWS KMS, GCP KMS, Vault, Privy, and Turnkey.
   *
   * @param options.feePayer - Whether the signer may sponsor transaction
   * fees. Defaults to `true`; set `false` for remote signers that must not
   * co-sign server-built transactions.
   */
  from(signer, options = {}) {
    return wrap(signer, { isFeePayer: options.feePayer ?? true });
  },
  /** Fresh ephemeral keypair (tests and throwaway environments). */
  async generate() {
    return wrap(await createMemorySignerFromKeyPair(await generateKeyPair()));
  },
  /** From a 128-character hex string (64 bytes). */
  async hex(secret) {
    if (!HEX_PATTERN.test(secret)) {
      throw new InvalidKeyError("Hex secrets must be exactly 128 hex characters (64 bytes).");
    }
    const bytes = Uint8Array.from({ length: 64 }, (_, i) => parseInt(secret.slice(i * 2, i * 2 + 2), 16));
    return await Signer.bytes(bytes);
  },
  /** From a Solana CLI JSON array string, e.g. `"[1,2,...,64]"`. */
  async json(jsonArray) {
    return wrap(await rethrowingInvalidKey(() => createMemorySignerFromPrivateKeyString(jsonArray)));
  }
};

// src/config.ts
var DEFAULT_EXPIRES_IN_SECONDS = 120;
function resolveChallengeBindingSecret(network, provided) {
  const secret = provided ?? process.env.PAY_KIT_MPP_SECRET ?? process.env.MPP_SECRET_KEY;
  if (secret) return secret;
  if (network !== "solana_localnet") {
    throw new ConfigurationError(
      "mpp.challengeBindingSecret is required outside localnet. Provide it in configure() or set PAY_KIT_MPP_SECRET."
    );
  }
  console.warn(
    "[pay-kit] Generated an ephemeral MPP challenge secret (localnet). Challenges will not survive restarts."
  );
  return crypto.randomUUID();
}
async function configure(params = {}) {
  const network = toNetwork(params.network ?? "solana_localnet");
  const accept = params.accept ?? ["mpp"];
  if (accept.length === 0) throw new ConfigurationError("accept must list at least one protocol.");
  for (const protocol of accept) {
    if (protocol !== "mpp" && protocol !== "x402") {
      throw new ProtocolNotSupportedError(
        `Protocol "${String(protocol)}" is not available in the TypeScript SDK yet (MPP and x402 only).`
      );
    }
  }
  const stablecoins = params.stablecoins ?? ["USDC"];
  if (stablecoins.length === 0) throw new ConfigurationError("stablecoins must list at least one coin.");
  for (const coin of stablecoins) {
    if (!STABLECOINS.includes(coin) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(coin)) {
      throw new ConfigurationError(`Unknown stablecoin "${coin}". Supported: ${STABLECOINS.join(", ")}.`);
    }
  }
  const provided = params.operator?.signer;
  const signer = provided === void 0 ? await Signer.demo() : "pubkey" in provided ? provided : Signer.from(provided, { feePayer: params.operator?.feePayer });
  if (signer.isDemo && network === "solana_mainnet") {
    throw new DemoSignerOnMainnetError(
      "The demo signer is public and must not be used on mainnet. Provide operator.signer."
    );
  }
  const operator = {
    feePayer: params.operator?.feePayer ?? true,
    recipient: params.operator?.recipient ?? signer.pubkey,
    signer
  };
  const expiresIn = params.mpp?.expiresIn ?? DEFAULT_EXPIRES_IN_SECONDS;
  if (expiresIn < 0 || !Number.isInteger(expiresIn)) {
    throw new ConfigurationError("mpp.expiresIn must be a non-negative integer number of seconds.");
  }
  const challengeBindingSecret = accept.includes("mpp") ? resolveChallengeBindingSecret(network, params.mpp?.challengeBindingSecret) : params.mpp?.challengeBindingSecret ?? "";
  return Object.freeze({
    accept: Object.freeze([...accept]),
    mpp: Object.freeze({
      challengeBindingSecret,
      expiresIn,
      html: params.mpp?.html ?? false,
      realm: params.mpp?.realm ?? "App"
    }),
    network,
    operator: Object.freeze(operator),
    preflight: params.preflight ?? true,
    replayStore: params.replayStore,
    rpcUrl: params.rpcUrl ?? DEFAULT_RPC_URLS[toSolanaNetwork(network)] ?? DEFAULT_RPC_URLS.mainnet,
    stablecoins: Object.freeze([...stablecoins]),
    x402: Object.freeze({
      ...params.x402,
      ...params.x402?.smartWalletAllowedPrograms && {
        smartWalletAllowedPrograms: Object.freeze([...params.x402.smartWalletAllowedPrograms])
      }
    })
  });
}
async function configureFromEnv(prefix = "PAY_KIT_") {
  const env = (name) => process.env[`${prefix}${name}`]?.trim() || void 0;
  const list = (value) => value?.split(",").map((entry) => entry.trim()) ?? void 0;
  const expiresIn = env("MPP_EXPIRES_IN");
  return await configure({
    accept: list(env("ACCEPT")),
    mpp: {
      challengeBindingSecret: env("MPP_SECRET"),
      expiresIn: expiresIn === void 0 ? void 0 : Number(expiresIn),
      realm: env("MPP_REALM")
    },
    network: env("NETWORK"),
    operator: {
      feePayer: env("FEE_PAYER") === void 0 ? void 0 : env("FEE_PAYER") !== "false",
      recipient: env("RECIPIENT"),
      signer: await Signer.env(`${prefix}OPERATOR_KEY`)
    },
    preflight: env("PREFLIGHT") === void 0 ? void 0 : env("PREFLIGHT") !== "false",
    rpcUrl: env("RPC_URL")
  });
}

// src/express-routes.ts
var GATE_METADATA = /* @__PURE__ */ Symbol.for("paykit.openapi.gate");
function toOpenApiPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}
function routerStackOf(app) {
  if (app._router?.stack) return app._router.stack;
  try {
    return app.router?.stack ?? [];
  } catch {
    return [];
  }
}
function gateOf(stack) {
  for (const layer of stack ?? []) {
    const gate = layer.handle?.[GATE_METADATA];
    if (gate !== void 0) return gate;
  }
  return void 0;
}
function introspectExpressRoutes(app) {
  const stack = routerStackOf(app);
  const routes2 = [];
  for (const layer of stack) {
    const route = layer.route;
    if (!route?.path) continue;
    const gate = gateOf(route.stack);
    if (gate === void 0) continue;
    const paths = Array.isArray(route.path) ? route.path : [route.path];
    for (const path of paths) {
      for (const method of Object.keys(route.methods ?? { get: true })) {
        routes2.push({ gate, method: method.toUpperCase(), path: toOpenApiPath(path) });
      }
    }
  }
  return routes2;
}

// src/gate.ts
var Gate = class _Gate {
  accept;
  amount;
  description;
  externalId;
  fees;
  kind;
  name;
  payTo;
  /** Metering config for `session` gates; `undefined` otherwise. */
  session;
  /** Plan binding for `subscription` gates; `undefined` otherwise. */
  subscription;
  constructor(params) {
    this.accept = Object.freeze([...params.accept]);
    this.amount = params.amount;
    this.description = params.description;
    this.externalId = params.externalId;
    this.fees = Object.freeze([...params.fees]);
    this.kind = params.kind;
    this.name = params.name;
    this.payTo = params.payTo;
    this.session = params.session ? Object.freeze({ ...params.session }) : void 0;
    this.subscription = params.subscription ? Object.freeze({ ...params.subscription }) : void 0;
    Object.freeze(this);
  }
  /**
   * Builds and validates a gate, resolving omitted fields from `defaults`.
   *
   * Validation rules (identical across the SDK family):
   * - fee currencies must match the amount currency,
   * - `feeWithin` fees must sum to less than the amount,
   * - fees with an explicit `accept` containing x402 fail
   *   ({@link ProtocolIncompatibleError}); with an inherited `accept` the
   *   gate silently narrows to MPP.
   *
   * @throws {ConfigurationError} on invalid amounts or fee sums.
   * @throws {MixedCurrenciesError} when a fee currency differs from the amount currency.
   * @throws {ProtocolIncompatibleError} when fees are combined with an explicit x402 accept.
   */
  static create(params, defaults) {
    const kind = params.kind ?? "fixed";
    const toFee = (recipient, spec, feeKind) => {
      const price = spec instanceof Price ? spec : spec.price;
      const memo = spec instanceof Price ? void 0 : spec.memo;
      return { kind: feeKind, price, recipient, ...memo ? { memo } : {} };
    };
    const fees = [
      ...Object.entries(params.feeWithin ?? {}).map(([recipient, spec]) => toFee(recipient, spec, "within")),
      ...Object.entries(params.feeOnTop ?? {}).map(([recipient, spec]) => toFee(recipient, spec, "on_top"))
    ];
    if ((kind === "usage" || kind === "subscription" || kind === "session") && fees.length > 0) {
      throw new ProtocolIncompatibleError(
        `Gate "${params.name}": ${kind} gates settle to a single recipient and cannot carry fees.`
      );
    }
    const payTo = params.payTo ?? defaults.payTo;
    for (const fee of fees) {
      if (fee.price.currency !== params.amount.currency) {
        throw new MixedCurrenciesError(
          `Gate "${params.name}": fee to ${fee.recipient} is denominated in ${fee.price.currency} but the amount is in ${params.amount.currency}.`
        );
      }
      if (fee.recipient === payTo) {
        throw new ConfigurationError(
          `Gate "${params.name}": fee recipient equals payTo. Fold the fee into the amount instead.`
        );
      }
    }
    const withinTotal = fees.filter((fee) => fee.kind === "within").reduce((sum, fee) => sum.plus(fee.price), params.amount.withAmount("0"));
    if (!params.amount.isGreaterThan(withinTotal)) {
      throw new ConfigurationError(
        `Gate "${params.name}": feeWithin total (${withinTotal.amount}) must be less than the amount (${params.amount.amount}).`
      );
    }
    let accept = params.accept ?? defaults.accept;
    if (kind === "usage") {
      if (params.accept && !params.accept.includes("x402")) {
        throw new ProtocolIncompatibleError(
          `Gate "${params.name}": usage (upto) gates require the x402 protocol.`
        );
      }
      accept = ["x402"];
    } else if (kind === "subscription" || kind === "session") {
      if (params.accept && !params.accept.includes("mpp")) {
        throw new ProtocolIncompatibleError(`Gate "${params.name}": ${kind} gates require the mpp protocol.`);
      }
      if (kind === "subscription" && !params.subscription) {
        throw new ConfigurationError(
          `Gate "${params.name}": subscription gates require a "subscription" plan binding (planId, periodUnit, periodCount, puller).`
        );
      }
      if (kind === "session" && !params.session) {
        throw new ConfigurationError(
          `Gate "${params.name}": session gates require a "session" config (unitPrice).`
        );
      }
      accept = ["mpp"];
    } else if (fees.length > 0) {
      if (params.accept?.includes("x402")) {
        throw new ProtocolIncompatibleError(
          `Gate "${params.name}": multi-recipient fees are not expressible in the x402 exact scheme. Remove the explicit x402 accept or the fees.`
        );
      }
      accept = accept.filter((protocol) => protocol !== "x402");
    }
    if (accept.length === 0) {
      throw new ConfigurationError(`Gate "${params.name}": accepts no protocols.`);
    }
    return new _Gate({
      accept,
      amount: params.amount,
      description: params.description,
      externalId: params.externalId,
      fees,
      kind,
      name: params.name,
      payTo,
      session: params.session,
      subscription: params.subscription
    });
  }
  /** Whether this gate accepts the given protocol. */
  accepts(protocol) {
    return this.accept.includes(protocol);
  }
  /** Fees added to the customer's total. */
  feeOnTop() {
    return this.fees.filter((fee) => fee.kind === "on_top");
  }
  /** Fees taken out of the amount. */
  feeWithin() {
    return this.fees.filter((fee) => fee.kind === "within");
  }
  /** Whether any fees are configured. */
  hasFees() {
    return this.fees.length > 0;
  }
  /** What `address` nets from one settlement, or `undefined` if it receives nothing. */
  payout(address6) {
    const feeTotal = (fees) => fees.reduce((sum, fee) => sum.plus(fee.price), this.amount.withAmount("0"));
    if (address6 === this.payTo) {
      return this.amount.minus(feeTotal(this.feeWithin()));
    }
    const toAddress = this.fees.filter((fee) => fee.recipient === address6);
    return toAddress.length > 0 ? feeTotal(toAddress) : void 0;
  }
  /** The customer's total: amount plus all on-top fees. */
  total() {
    return this.feeOnTop().reduce((sum, fee) => sum.plus(fee.price), this.amount);
  }
};

// src/openapi.ts
function buildOpenApiDocument(config) {
  const paths = {};
  for (const route of config.routes) {
    const method = route.method.toLowerCase();
    const operation = {
      responses: {
        ...route.offers ? { "402": { description: "Payment Required" } } : {},
        "200": { description: "Successful response" }
      }
    };
    if (route.offers) operation["x-payment-info"] = { offers: route.offers };
    if (route.summary) operation.summary = route.summary;
    if (route.requestBody) operation.requestBody = route.requestBody;
    (paths[route.path] ??= {})[method] = operation;
  }
  const doc = {
    info: { title: config.info?.title ?? "API", version: config.info?.version ?? "1.0.0" },
    openapi: "3.1.0",
    paths
  };
  if (config.serviceInfo) doc["x-service-info"] = config.serviceInfo;
  return doc;
}

// src/adapters/mpp.ts
import { Receipt as Receipt3 } from "mppx";
var SETTLEMENT_SIGNATURE_HEADER = "x-payment-settlement-signature";
function splitsFor(gate) {
  return gate.fees.map((fee) => ({
    amount: fee.price.baseUnits().toString(),
    recipient: fee.recipient,
    ...fee.memo ? { memo: fee.memo } : {}
  }));
}
function totalAmount(gate) {
  return gate.total().baseUnits();
}
function schemeFor(gate) {
  return gate.kind === "subscription" ? "subscription" : "charge";
}
function createMppAdapter(config) {
  const network = toSolanaNetwork(config.network);
  const handlers = /* @__PURE__ */ new Map();
  function handlerFor(gate) {
    const coin = resolveCoin(gate.amount, config.stablecoins);
    const mint = requireMint(coin, resolveStablecoinMint(coin, network), config.network);
    const splits = splitsFor(gate);
    const key = JSON.stringify([
      gate.kind,
      gate.payTo,
      mint,
      splits,
      gate.subscription ?? null,
      totalAmount(gate).toString(),
      gate.description ?? null,
      gate.externalId ?? null
    ]);
    let handler = handlers.get(key);
    if (!handler) {
      const signer = config.operator.feePayer ? { signer: config.operator.signer.signer } : {};
      if (gate.subscription) {
        const { periodCount, periodUnit, planId, puller } = gate.subscription;
        const mppx = Mppx.create({
          methods: [
            solana.subscription({
              decimals: 6,
              mint,
              network,
              periodCount,
              periodUnit,
              planId,
              puller,
              recipient: gate.payTo,
              rpcUrl: config.rpcUrl,
              subscriptionProgram: SUBSCRIPTIONS_PROGRAM,
              tokenProgram: TOKEN_PROGRAM,
              ...signer
            })
          ],
          realm: config.mpp.realm,
          secretKey: config.mpp.challengeBindingSecret
        });
        handler = (request) => mppx.subscription({
          amount: totalAmount(gate).toString(),
          currency: mint,
          methodDetails: {
            decimals: 6,
            mint,
            network,
            planAddress: planId,
            puller,
            subscriptionProgram: SUBSCRIPTIONS_PROGRAM,
            tokenProgram: TOKEN_PROGRAM
          },
          periodCount: String(periodCount),
          periodUnit,
          recipient: gate.payTo,
          ...gate.description ? { description: gate.description } : {},
          ...gate.externalId ? { externalId: gate.externalId } : {}
        })(request);
      } else {
        const mppx = Mppx.create({
          methods: [
            solana.charge({
              currency: mint,
              decimals: 6,
              ...config.mpp.html ? { html: true } : {},
              network,
              recipient: gate.payTo,
              rpcUrl: config.rpcUrl,
              ...signer,
              ...splits.length > 0 ? { splits: [...splits] } : {},
              ...config.replayStore ? { store: config.replayStore } : {}
            })
          ],
          realm: config.mpp.realm,
          secretKey: config.mpp.challengeBindingSecret
        });
        handler = (request) => mppx.charge(optionsFor(gate))(request);
      }
      handlers.set(key, handler);
    }
    return handler;
  }
  function optionsFor(gate) {
    return {
      amount: totalAmount(gate).toString(),
      ...gate.description ? { description: gate.description } : {},
      ...gate.externalId ? { externalId: gate.externalId } : {},
      ...config.mpp.expiresIn > 0 ? { expires: new Date(Date.now() + config.mpp.expiresIn * 1e3).toISOString() } : {}
    };
  }
  return {
    acceptsEntry(gate) {
      const coin = resolveCoin(gate.amount, config.stablecoins);
      const splits = splitsFor(gate);
      return Promise.resolve({
        amount: totalAmount(gate).toString(),
        currency: coin,
        network: caip2(config.network),
        payTo: gate.payTo,
        protocol: "mpp",
        realm: config.mpp.realm,
        scheme: schemeFor(gate),
        ...splits.length > 0 ? { splits } : {},
        ...gate.subscription ? { planId: gate.subscription.planId } : {}
      });
    },
    async challengeHeaders(gate, request) {
      const result = await handlerFor(gate)(request);
      if (result.status !== 402) return {};
      const wwwAuthenticate = result.challenge.headers.get("www-authenticate");
      return wwwAuthenticate ? { "www-authenticate": wwwAuthenticate } : {};
    },
    detect(request) {
      return request.headers.get("authorization")?.toLowerCase().startsWith("payment ") ?? false;
    },
    protocol: "mpp",
    // The mppx charge method (with `html: true`) content-negotiates the 402:
    // `result.challenge` is the interactive HTML payment page for browsers
    // (`Accept: text/html`) and the service-worker script for the
    // `?__mppx_worker` request — each with its own status (402 / 200). Hand
    // that Response back for pay-kit to send.
    async respond(gate, request) {
      if (!config.mpp.html) return void 0;
      const result = await handlerFor(gate)(request);
      if (result.status !== 402) return void 0;
      const response = result.challenge;
      const url = new URL(request.url);
      if (url.searchParams.has("__mppx_worker") || url.searchParams.has("__mpp_worker")) {
        const headers = new Headers(response.headers);
        headers.set("Service-Worker-Allowed", "/");
        return new Response(response.body, { headers, status: response.status });
      }
      return response;
    },
    scheme: "charge",
    async verifyAndSettle(gate, request) {
      const result = await handlerFor(gate)(request);
      if (result.status === 402) {
        throw new InvalidProofError(...await problemOf(result.challenge));
      }
      const sealed = result.withReceipt(new Response(null));
      const receiptHeader = sealed.headers.get("payment-receipt");
      const receipt = receiptHeader ? Receipt3.deserialize(receiptHeader) : void 0;
      const transaction = receipt?.reference ?? "";
      return {
        gateName: gate.name,
        payer: void 0,
        protocol: "mpp",
        raw: request.headers.get("authorization") ?? void 0,
        scheme: schemeFor(gate),
        settlementHeaders: {
          ...receiptHeader ? { "payment-receipt": receiptHeader } : {},
          ...transaction ? { [SETTLEMENT_SIGNATURE_HEADER]: transaction } : {}
        },
        transaction
      };
    }
  };
}
async function problemOf(challenge) {
  try {
    const body = await challenge.clone().json();
    if (typeof body === "object" && body !== null) {
      const problem = body;
      const code = typeof problem.code === "string" ? problem.code : "invalid_proof";
      const detail = typeof problem.detail === "string" ? problem.detail : typeof problem.title === "string" ? problem.title : void 0;
      return [code, detail];
    }
  } catch {
  }
  return ["invalid_proof", void 0];
}

// src/adapters/mpp-session.ts
import { createSolanaRpc as createSolanaRpc3 } from "@solana/kit";
function createSessionEngine(config, gate) {
  if (!gate.session) {
    throw new ConfigurationError(`Gate "${gate.name}": session engine requires a session config.`);
  }
  if (!config.operator.feePayer) {
    throw new ConfigurationError(
      `Gate "${gate.name}": session gates require an operator that sponsors fees (operator.feePayer).`
    );
  }
  const network = toSolanaNetwork(config.network);
  const coin = resolveCoin(gate.amount, config.stablecoins);
  const mint = requireMint(coin, resolveStablecoinMint(coin, network), config.network);
  const signer = config.operator.signer.signer;
  const store = createMemorySessionStore();
  const idleTimeoutSeconds = gate.session.closeDelayMs === void 0 ? 300 : Math.max(1, Math.ceil(gate.session.closeDelayMs / 1e3));
  const params = {
    amount: gate.session.unitPrice,
    channelProgram: PAYMENT_CHANNELS_PROGRAM_ID2,
    currency: mint,
    decimals: 6,
    feePayer: true,
    feePayerSigner: signer,
    gracePeriodSeconds: 900,
    idleTimeoutSeconds,
    network,
    recipient: gate.payTo,
    rpc: createSolanaRpc3(config.rpcUrl),
    signer,
    store,
    suggestedDeposit: gate.amount.baseUnits()
  };
  const mppx = Mppx.create({
    methods: [session2(params)],
    realm: config.mpp.realm,
    secretKey: config.mpp.challengeBindingSecret
  });
  const handler = mppx.session({
    amount: params.amount.toString(),
    currency: mint,
    description: gate.description ?? "Metered session",
    methodDetails: {
      channelProgram: PAYMENT_CHANNELS_PROGRAM_ID2.toString(),
      network
    },
    recipient: gate.payTo
  });
  const routes2 = session2.routes(params);
  return {
    commit: (request) => routes2.commit(request),
    deliveries: (request) => routes2.deliveries(request),
    handler: (request) => handler(request),
    async receipt(channelId) {
      const state = await store.getChannel(channelId);
      if (!state) return void 0;
      return {
        channelId: state.channelId,
        cumulative: state.cumulative.toString(),
        deposit: state.deposit.toString(),
        sealed: state.sealed,
        settledSignature: state.settledSignature ?? null
      };
    }
  };
}

// src/adapters/x402.ts
import { createSolanaRpc as createSolanaRpc4 } from "@solana/kit";

// ../../node_modules/.pnpm/@x402+svm@file+.x402-vendor+x402-svm-2.23.0.tgz_@solana+kit@6.10.0_bufferutil@4.1.0_fas_4024990b1dd87ed6a149db0849575943/node_modules/@x402/svm/dist/esm/exact/facilitator/index.mjs
import {
  COMPUTE_BUDGET_PROGRAM_ADDRESS as COMPUTE_BUDGET_PROGRAM_ADDRESS3,
  parseSetComputeUnitLimitInstruction,
  parseSetComputeUnitPriceInstruction as parseSetComputeUnitPriceInstruction2
} from "@solana-program/compute-budget";
import {
  parseTransferCheckedInstruction as parseTransferCheckedInstructionToken,
  TOKEN_PROGRAM_ADDRESS as TOKEN_PROGRAM_ADDRESS3
} from "@solana-program/token";
import {
  findAssociatedTokenPda as findAssociatedTokenPda5,
  parseTransferCheckedInstruction as parseTransferCheckedInstruction2022,
  TOKEN_2022_PROGRAM_ADDRESS as TOKEN_2022_PROGRAM_ADDRESS3
} from "@solana-program/token-2022";
import {
  decompileTransactionMessage as decompileTransactionMessage3,
  getCompiledTransactionMessageDecoder as getCompiledTransactionMessageDecoder7
} from "@solana/kit";
var DEFAULT_SMART_WALLET_ALLOWED_PROGRAMS = [
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
  // Squads Multisig v4
  "SMRTzfY6DfH5ik3TKiyLFfXexV8uSG3d2UksSCYdunG",
  // Squads Smart Account
  "SWiGmQedKzMz1tiTqoJCWeGDnGXfNBp2PkXLkpCAtQo",
  // Swig (legacy)
  "swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB",
  // Swig v2 (@swig-wallet/kit 2.x)
  "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw",
  // SPL Governance
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
  // Metaplex Core
  LIGHTHOUSE_PROGRAM_ADDRESS
  // Phantom's wallet-protection assertions (see #2097)
];
var IX_TOKEN_TRANSFER_CHECKED2 = 12;
var LAYOUT_RECOVERABLE_REASONS = /* @__PURE__ */ new Set([
  "invalid_exact_svm_payload_transaction_instructions_length",
  "invalid_exact_svm_payload_no_transfer_instruction",
  "invalid_exact_svm_payload_unknown_fourth_instruction",
  "invalid_exact_svm_payload_unknown_fifth_instruction",
  "invalid_exact_svm_payload_unknown_sixth_instruction",
  "invalid_exact_svm_payload_unknown_optional_instruction",
  "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction",
  "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction"
]);
function assertLimit2(name, value, min) {
  if (value === void 0) return;
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be a safe integer >= ${min}, received ${value}`);
  }
}
var ExactSvmScheme2 = class {
  /**
   * Creates a new ExactSvmScheme instance.
   *
   * @param signer - The SVM signer for facilitator operations
   * @param settlementCache - Optional shared settlement cache (one is created if omitted)
   * @param options - Optional configuration for smart wallet verification
   */
  constructor(signer, settlementCache, options) {
    this.signer = signer;
    this.options = options;
    this.scheme = "exact";
    this.caipFamily = "solana:*";
    this.settlementCache = settlementCache ?? new SettlementCache();
    assertLimit2("maxPriorityFeeMicroLamports", this.options?.maxPriorityFeeMicroLamports, 0);
    assertLimit2("maxComputeUnits", this.options?.maxComputeUnits, 1);
    assertLimit2("maxRequiredSignatures", this.options?.maxRequiredSignatures, 1);
    if (this.options?.enableSmartWalletVerification) {
      const required = [
        "simulateTransactionWithInnerInstructions",
        "getConfirmedTransactionInnerInstructions",
        "getTokenAccountBalance",
        "fetchAddressLookupTables"
      ];
      for (const method of required) {
        if (typeof this.signer[method] !== "function") {
          throw new Error(
            `enableSmartWalletVerification requires ${method} on the signer. Use toFacilitatorSvmSigner() which provides all required methods.`
          );
        }
      }
    }
  }
  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For SVM, this includes a randomly selected fee payer address.
   * Random selection distributes load across multiple signers.
   *
   * @param _ - The network identifier (unused for SVM)
   * @returns Extra data with feePayer address
   */
  getExtra(_) {
    const addresses = this.signer.getAddresses();
    const randomIndex = Math.floor(Math.random() * addresses.length);
    const extra = { feePayer: addresses[randomIndex] };
    if (this.options?.enableSmartWalletVerification) {
      extra.features = { smartWalletSupported: true };
    }
    return extra;
  }
  /**
   * Get signer addresses used by this facilitator.
   * For SVM, returns all available fee payer addresses.
   *
   * @param _ - The network identifier (unused for SVM)
   * @returns Array of fee payer addresses
   */
  getSigners(_) {
    return [...this.signer.getAddresses()];
  }
  /**
   * Verifies a payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(payload, requirements) {
    const { response } = await this._verify(payload, requirements);
    return response;
  }
  /**
   * Settles a payment by submitting the transaction.
   * Ensures the correct signer is used based on the feePayer specified in requirements.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(payload, requirements) {
    const exactSvmPayload = payload.payload;
    const { response: valid, verificationPath } = await this._verify(payload, requirements);
    if (!valid.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: valid.invalidReason ?? "verification_failed",
        payer: valid.payer || ""
      };
    }
    const decodedTx = decodeTransactionFromPayload(exactSvmPayload);
    const txKey = transactionMessageHash(decodedTx);
    if (this.settlementCache.isDuplicate(txKey)) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "duplicate_settlement",
        payer: valid.payer || ""
      };
    }
    const isSmartWalletSettlement = verificationPath === "smartWallet";
    let balanceBefore = null;
    let balanceBeforeTokenProgram = null;
    if (isSmartWalletSettlement && typeof this.signer.getTokenAccountBalance === "function") {
      for (const tokenProgram of [TOKEN_PROGRAM_ADDRESS3, TOKEN_2022_PROGRAM_ADDRESS3]) {
        try {
          const [destinationAta] = await findAssociatedTokenPda5({
            mint: requirements.asset,
            owner: requirements.payTo,
            tokenProgram
          });
          const balance = await this.signer.getTokenAccountBalance(
            destinationAta.toString(),
            requirements.network
          );
          if (balance !== null) {
            balanceBefore = balance;
            balanceBeforeTokenProgram = tokenProgram;
            break;
          }
        } catch {
        }
      }
    }
    try {
      const feePayer = requirements.extra.feePayer;
      const fullySignedTransaction = await this.signer.signTransaction(
        exactSvmPayload.transaction,
        feePayer,
        requirements.network
      );
      const signature = await this.signer.sendTransaction(
        fullySignedTransaction,
        requirements.network
      );
      await this.signer.confirmTransaction(signature, requirements.network);
      if (isSmartWalletSettlement) {
        const signerAddresses = this.signer.getAddresses().map((a) => a.toString());
        const postVerify = await verifyPostSettlement(
          this.signer,
          signature,
          requirements.network,
          requirements,
          signerAddresses,
          balanceBefore,
          balanceBeforeTokenProgram?.toString() ?? null
        );
        if (!postVerify.verified) {
          return {
            success: false,
            errorReason: "post_settlement_transfer_not_confirmed",
            transaction: signature,
            network: payload.accepted.network,
            payer: valid.payer || ""
          };
        }
      }
      return {
        success: true,
        transaction: signature,
        network: payload.accepted.network,
        payer: valid.payer
      };
    } catch (error) {
      this.settlementCache.delete(txKey);
      console.error("Failed to settle transaction:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: valid.payer || ""
      };
    }
  }
  /**
   * Internal verification that also reports which path validated the payment.
   *
   * settle() consumes verificationPath to decide whether post-settlement TOCTOU
   * verification is required, instead of re-decoding the transaction and
   * inferring the path from a missing token payer.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Verify response plus the path that succeeded (null on failure)
   */
  async _verify(payload, requirements) {
    const exactSvmPayload = payload.payload;
    if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact") {
      return {
        response: { isValid: false, invalidReason: "unsupported_scheme", payer: "" },
        verificationPath: null
      };
    }
    if (payload.accepted.network !== requirements.network) {
      return {
        response: { isValid: false, invalidReason: "network_mismatch", payer: "" },
        verificationPath: null
      };
    }
    if (!requirements.extra?.feePayer || typeof requirements.extra.feePayer !== "string") {
      return {
        response: {
          isValid: false,
          invalidReason: "invalid_exact_svm_payload_missing_fee_payer",
          payer: ""
        },
        verificationPath: null
      };
    }
    const signerAddresses = this.signer.getAddresses().map((addr) => addr.toString());
    if (!signerAddresses.includes(requirements.extra.feePayer)) {
      return {
        response: {
          isValid: false,
          invalidReason: "fee_payer_not_managed_by_facilitator",
          payer: ""
        },
        verificationPath: null
      };
    }
    let transaction;
    try {
      transaction = decodeTransactionFromPayload(exactSvmPayload);
    } catch {
      return {
        response: {
          isValid: false,
          invalidReason: "invalid_exact_svm_payload_transaction_could_not_be_decoded",
          payer: ""
        },
        verificationPath: null
      };
    }
    const maxRequiredSignatures = this.options?.maxRequiredSignatures;
    if (maxRequiredSignatures !== void 0) {
      const compiledForSignerCheck = getCompiledTransactionMessageDecoder7().decode(
        transaction.messageBytes
      );
      const numRequiredSignatures = compiledForSignerCheck.header.numSignerAccounts;
      if (numRequiredSignatures > maxRequiredSignatures) {
        return {
          response: {
            isValid: false,
            invalidReason: "invalid_exact_svm_payload_excessive_signers",
            payer: ""
          },
          verificationPath: null
        };
      }
    }
    const staticResult = await this.verifyStaticPath(
      transaction,
      exactSvmPayload,
      requirements,
      signerAddresses
    );
    if (staticResult.isValid) {
      return { response: staticResult, verificationPath: "static" };
    }
    const staticReasonRecoverable = typeof staticResult.invalidReason === "string" && LAYOUT_RECOVERABLE_REASONS.has(staticResult.invalidReason);
    if (this.options?.enableSmartWalletVerification && staticReasonRecoverable) {
      const allowedPrograms = new Set(
        this.options.smartWalletAllowedPrograms ?? DEFAULT_SMART_WALLET_ALLOWED_PROGRAMS
      );
      const compiled = getCompiledTransactionMessageDecoder7().decode(transaction.messageBytes);
      const decompiledForCheck = decompileTransactionMessage3(compiled);
      const rawInstructions = decompiledForCheck.instructions ?? [];
      const topLevelPrograms = [];
      for (const ix of rawInstructions) {
        const addr = ix.programAddress.toString();
        if (addr === COMPUTE_BUDGET_PROGRAM_ADDRESS3.toString() || addr === MEMO_PROGRAM_ADDRESS) {
          continue;
        }
        topLevelPrograms.push(addr);
      }
      const disallowedProgram = topLevelPrograms.find((addr) => !allowedPrograms.has(addr));
      if (disallowedProgram) {
        return {
          response: {
            isValid: false,
            invalidReason: `smart_wallet_program_not_allowed: ${disallowedProgram}`,
            payer: ""
          },
          verificationPath: null
        };
      }
      const feePayer = requirements.extra.feePayer;
      const smartWalletResult = await verifySmartWalletTransaction(
        exactSvmPayload.transaction,
        requirements,
        this.signer,
        feePayer,
        signerAddresses,
        {
          enabled: true,
          maxComputeUnits: this.options.smartWalletMaxComputeUnits,
          maxPriorityFeeMicroLamports: this.options.smartWalletMaxPriorityFeeMicroLamports
        }
      );
      return {
        response: smartWalletResult,
        verificationPath: smartWalletResult.isValid ? "smartWallet" : null
      };
    }
    return { response: staticResult, verificationPath: null };
  }
  /**
   * Path 1: Static instruction-layout verification for standard wallets.
   * Validates positional instruction structure, program allowlist, and
   * transfer details. Unchanged from the original implementation.
   *
   * @param transaction - Decoded transaction to verify
   * @param exactSvmPayload - The raw SVM payload containing the base64 transaction
   * @param requirements - Payment requirements to verify against
   * @param signerAddresses - Facilitator signer addresses (for self-spend protection)
   * @returns Verification result
   */
  async verifyStaticPath(transaction, exactSvmPayload, requirements, signerAddresses) {
    const compiled = getCompiledTransactionMessageDecoder7().decode(transaction.messageBytes);
    const decompiled = decompileTransactionMessage3(compiled);
    const instructions = decompiled.instructions ?? [];
    if (instructions.length < 3 || instructions.length > 7) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_transaction_instructions_length",
        payer: ""
      };
    }
    try {
      this.verifyComputeLimitInstruction(instructions[0]);
      this.verifyComputePriceInstruction(instructions[1]);
    } catch (error) {
      const errorMessage4 = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        invalidReason: errorMessage4,
        payer: ""
      };
    }
    const payer = getTokenPayerFromTransaction(transaction);
    if (!payer) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_no_transfer_instruction",
        payer: ""
      };
    }
    const transferIx = instructions[2];
    const programAddress2 = transferIx.programAddress.toString();
    if (programAddress2 !== TOKEN_PROGRAM_ADDRESS3.toString() && programAddress2 !== TOKEN_2022_PROGRAM_ADDRESS3.toString()) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_no_transfer_instruction",
        payer
      };
    }
    const ixData = transferIx.data;
    if (!ixData || ixData.length < 10 || ixData[0] !== IX_TOKEN_TRANSFER_CHECKED2) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_no_transfer_instruction",
        payer
      };
    }
    let parsedTransfer;
    try {
      if (programAddress2 === TOKEN_PROGRAM_ADDRESS3.toString()) {
        parsedTransfer = parseTransferCheckedInstructionToken(transferIx);
      } else {
        parsedTransfer = parseTransferCheckedInstruction2022(transferIx);
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_no_transfer_instruction",
        payer
      };
    }
    const authorityAddress = parsedTransfer.accounts.authority.address.toString();
    if (signerAddresses.includes(authorityAddress)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
        payer
      };
    }
    const mintAddress = parsedTransfer.accounts.mint.address.toString();
    if (mintAddress !== requirements.asset) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_mint_mismatch",
        payer
      };
    }
    const destATA = parsedTransfer.accounts.destination.address.toString();
    try {
      const [expectedDestATA] = await findAssociatedTokenPda5({
        mint: requirements.asset,
        owner: requirements.payTo,
        tokenProgram: programAddress2 === TOKEN_PROGRAM_ADDRESS3.toString() ? TOKEN_PROGRAM_ADDRESS3 : TOKEN_2022_PROGRAM_ADDRESS3
      });
      if (destATA !== expectedDestATA.toString()) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_svm_payload_recipient_mismatch",
          payer
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_recipient_mismatch",
        payer
      };
    }
    const amount = parsedTransfer.data.amount;
    if (amount !== BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_svm_payload_amount_mismatch",
        payer
      };
    }
    const optionalInstructions = instructions.slice(3);
    const invalidReasonByIndex = [
      "invalid_exact_svm_payload_unknown_fourth_instruction",
      "invalid_exact_svm_payload_unknown_fifth_instruction",
      "invalid_exact_svm_payload_unknown_sixth_instruction",
      "invalid_exact_svm_payload_unknown_seventh_instruction"
    ];
    for (let i = 0; i < optionalInstructions.length; i += 1) {
      const programAddress22 = optionalInstructions[i].programAddress.toString();
      if (programAddress22 === LIGHTHOUSE_PROGRAM_ADDRESS || programAddress22 === MEMO_PROGRAM_ADDRESS) {
        continue;
      }
      return {
        isValid: false,
        invalidReason: invalidReasonByIndex[i] ?? "invalid_exact_svm_payload_unknown_optional_instruction",
        payer
      };
    }
    const expectedMemo = requirements.extra?.memo;
    if (expectedMemo) {
      const memoInstructions = optionalInstructions.filter(
        (ix) => ix.programAddress.toString() === MEMO_PROGRAM_ADDRESS
      );
      if (memoInstructions.length !== 1) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_svm_payload_memo_count",
          payer
        };
      }
      const memoData = memoInstructions[0].data;
      const actualMemo = memoData ? new TextDecoder().decode(new Uint8Array(memoData)) : "";
      if (actualMemo !== expectedMemo) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_svm_payload_memo_mismatch",
          payer
        };
      }
    }
    try {
      const feePayer = requirements.extra.feePayer;
      const fullySignedTransaction = await this.signer.signTransaction(
        exactSvmPayload.transaction,
        feePayer,
        requirements.network
      );
      await this.signer.simulateTransaction(fullySignedTransaction, requirements.network);
    } catch (error) {
      const errorMessage4 = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        invalidReason: "transaction_simulation_failed",
        invalidMessage: errorMessage4,
        payer
      };
    }
    return {
      isValid: true,
      invalidReason: void 0,
      payer
    };
  }
  /**
   * Verify that the compute limit instruction is valid.
   *
   * @param instruction - The compute limit instruction
   * @param instruction.programAddress - Program address
   * @param instruction.data - Instruction data bytes
   */
  verifyComputeLimitInstruction(instruction) {
    const programAddress2 = instruction.programAddress.toString();
    if (programAddress2 !== COMPUTE_BUDGET_PROGRAM_ADDRESS3.toString() || !instruction.data || instruction.data[0] !== 2) {
      throw new Error(
        "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction"
      );
    }
    try {
      const parsedInstruction = parseSetComputeUnitLimitInstruction(instruction);
      const maxComputeUnits = this.options?.maxComputeUnits;
      if (maxComputeUnits !== void 0 && parsedInstruction.data.units > maxComputeUnits) {
        throw new Error(
          "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction_too_high"
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("too_high")) {
        throw error;
      }
      throw new Error(
        "invalid_exact_svm_payload_transaction_instructions_compute_limit_instruction"
      );
    }
  }
  /**
   * Verify that the compute price instruction is valid.
   *
   * @param instruction - The compute price instruction
   * @param instruction.programAddress - Program address
   * @param instruction.data - Instruction data bytes
   */
  verifyComputePriceInstruction(instruction) {
    const programAddress2 = instruction.programAddress.toString();
    if (programAddress2 !== COMPUTE_BUDGET_PROGRAM_ADDRESS3.toString() || !instruction.data || instruction.data[0] !== 3) {
      throw new Error(
        "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction"
      );
    }
    try {
      const parsedInstruction = parseSetComputeUnitPriceInstruction2(instruction);
      const maxPriorityFee = this.options?.maxPriorityFeeMicroLamports ?? MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS;
      if (parsedInstruction.data.microLamports > BigInt(maxPriorityFee)) {
        throw new Error(
          "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction_too_high"
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("too_high")) {
        throw error;
      }
      throw new Error(
        "invalid_exact_svm_payload_transaction_instructions_compute_price_instruction"
      );
    }
  }
};

// src/adapters/x402.ts
var X402_VERSION2 = 2;
var MAX_TIMEOUT_SECONDS2 = 300;
var PAYMENT_RESPONSE_HEADER2 = "x-payment-response";
var PAYMENT_REQUIRED_HEADER2 = "payment-required";
function createX402ExactAdapter(config) {
  const network = caip2(config.network);
  const operator = config.operator.signer.pubkey;
  const { smartWalletAllowedPrograms, ...schemeOptionsWithoutAllowlist } = config.x402;
  const schemeOptions = {
    ...schemeOptionsWithoutAllowlist,
    ...smartWalletAllowedPrograms && {
      smartWalletAllowedPrograms: [...smartWalletAllowedPrograms]
    }
  };
  const facilitator = new x402Facilitator().register(
    network,
    new ExactSvmScheme2(
      toFacilitatorSvmSigner(config.operator.signer.signer, { defaultRpcUrl: config.rpcUrl }),
      void 0,
      schemeOptions
    )
  );
  function mintFor(gate) {
    const coin = resolveCoin(gate.amount, config.stablecoins);
    return requireMint(coin, resolveStablecoinMint2(coin, network), config.network);
  }
  function requirementsFor(gate) {
    return {
      amount: gate.total().baseUnits().toString(),
      asset: mintFor(gate),
      extra: { feePayer: operator },
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS2,
      network,
      payTo: gate.payTo,
      scheme: "exact"
    };
  }
  async function challengeRequirements(gate) {
    const base = requirementsFor(gate);
    try {
      const { value } = await createSolanaRpc4(config.rpcUrl).getLatestBlockhash().send();
      return {
        ...base,
        extra: {
          ...base.extra,
          lastValidBlockHeight: value.lastValidBlockHeight.toString(),
          recentBlockhash: value.blockhash
        }
      };
    } catch {
      return base;
    }
  }
  return {
    acceptsEntry(gate) {
      const requirements = requirementsFor(gate);
      return Promise.resolve({ ...requirements, protocol: "x402" });
    },
    async challengeHeaders(gate, request) {
      const paymentRequired = {
        accepts: [await challengeRequirements(gate)],
        // x402 v2 clients bind the challenge to Response.url exactly.
        // Keep the browser-facing origin supplied by the HTTP adapter;
        // a pathname-only value fails that validation behind a proxy.
        resource: { url: request.url },
        x402Version: X402_VERSION2
      };
      return { [PAYMENT_REQUIRED_HEADER2]: encodePaymentRequiredHeader(paymentRequired) };
    },
    detect(request) {
      return x402PaymentHeader(request) !== void 0;
    },
    protocol: "x402",
    scheme: "exact",
    async verifyAndSettle(gate, request) {
      const header = x402PaymentHeader(request);
      if (!header) throw new InvalidProofError("missing_x402_payment_header");
      let payload;
      try {
        payload = decodePaymentSignatureHeader(header);
      } catch (error) {
        throw new InvalidProofError("invalid_x402_payment_header", errorMessage3(error));
      }
      rejectLegacyTransaction(
        payload.payload?.transaction,
        "invalid_exact_svm_payload_transaction_could_not_be_decoded"
      );
      const requirements = requirementsFor(gate);
      const verification = await facilitator.verify(payload, requirements);
      if (!verification.isValid) {
        throw new InvalidProofError(verification.invalidReason ?? "invalid_proof", verification.invalidMessage);
      }
      const settlement = await facilitator.settle(payload, requirements);
      if (!settlement.success) {
        throw new InvalidProofError(settlement.errorReason ?? "settlement_failed", settlement.errorMessage);
      }
      return {
        gateName: gate.name,
        payer: settlement.payer ?? verification.payer,
        protocol: "x402",
        raw: header,
        scheme: "exact",
        settlementHeaders: { [PAYMENT_RESPONSE_HEADER2]: encodePaymentResponseHeader(settlement) },
        transaction: settlement.transaction
      };
    }
  };
}

// src/http.ts
import { Buffer as Buffer2 } from "buffer";
function toWebRequest(req) {
  const protocol = req.protocol ?? "http";
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.originalUrl ?? req.url ?? "/", `${protocol}://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === void 0) continue;
    for (const entry of Array.isArray(value) ? value : [value]) headers.append(name, entry);
  }
  return new Request(url, { headers, method: req.method ?? "GET" });
}
async function sendResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer2.from(await response.arrayBuffer()));
}

// src/pricing.ts
function usage(max, params = {}) {
  return { ...params, amount: max, kind: "usage" };
}
function subscription3(amount, config) {
  const { periodCount, periodUnit, planId, puller, ...rest } = config;
  return { ...rest, amount, kind: "subscription", subscription: { periodCount, periodUnit, planId, puller } };
}
function session3(cap, config) {
  const { closeDelayMs, unitPrice, ...rest } = config;
  return {
    ...rest,
    amount: cap,
    kind: "session",
    session: { unitPrice: unitPrice.baseUnits(), ...closeDelayMs !== void 0 ? { closeDelayMs } : {} }
  };
}
var DynamicGate = class {
  name;
  #defaults;
  #resolver;
  constructor(name, resolver, defaults) {
    this.name = name;
    this.#defaults = defaults;
    this.#resolver = resolver;
  }
  /** Materializes the gate for one request. */
  async resolve(request) {
    const result = await this.#resolver(request);
    const params = result instanceof Price ? { amount: result } : result;
    return Gate.create({ ...params, name: this.name }, this.#defaults);
  }
};
var Pricing = class {
  #gates;
  constructor(gates) {
    this.#gates = gates;
  }
  /**
   * Looks up a gate by name.
   *
   * @throws {UnknownGateError} when the name is not registered.
   */
  gate(name) {
    const gate = this.#gates.get(name);
    if (!gate) throw new UnknownGateError(name);
    return gate;
  }
  /** All registered gate names. */
  names() {
    return [...this.#gates.keys()];
  }
};
function gateDefaults(config) {
  return { accept: config.accept, payTo: config.operator.recipient };
}
function createPricing(config, definitions) {
  const defaults = gateDefaults(config);
  const gates = /* @__PURE__ */ new Map();
  for (const [name, definition] of Object.entries(definitions)) {
    if (typeof definition === "function") {
      gates.set(name, new DynamicGate(name, definition, defaults));
    } else {
      const params = definition instanceof Price ? { amount: definition } : definition;
      gates.set(name, Gate.create({ ...params, name }, defaults));
    }
  }
  return new Pricing(gates);
}

// src/paykit.ts
async function createPayKit(options = {}) {
  const {
    adapters: adapterOverride,
    config: prebuilt,
    onSettleError,
    pricing: pricingDef,
    ...configureParams
  } = options;
  const config = prebuilt ?? await configure(configureParams);
  const handleSettleFailure = onSettleError ?? warnSettleFailure;
  const adapters = adapterOverride ?? config.accept.map((protocol) => {
    if (protocol === "mpp") return createMppAdapter(config);
    if (protocol === "x402") return createX402ExactAdapter(config);
    throw new ConfigurationError(`No adapter for protocol "${String(protocol)}".`);
  });
  const pricing = pricingDef ? createPricing(config, pricingDef) : void 0;
  const upto = config.accept.includes("x402") ? new X402Upto(config) : void 0;
  const defaults = gateDefaults(config);
  const payments = /* @__PURE__ */ new WeakMap();
  const charges = /* @__PURE__ */ new WeakMap();
  const inFlightUptoChannels = /* @__PURE__ */ new Set();
  const sessionEngines = /* @__PURE__ */ new Map();
  function sessionEngineFor(gate) {
    let engine = sessionEngines.get(gate.name);
    if (!engine) {
      engine = createSessionEngine(config, gate);
      sessionEngines.set(gate.name, engine);
    }
    return engine;
  }
  function resolveStaticGate(ref) {
    if (ref instanceof Gate) return ref;
    if (!pricing) {
      throw new ConfigurationError(
        `Gate "${ref}" referenced by name but no pricing catalogue was passed to createPayKit().`
      );
    }
    const gate = pricing.gate(ref);
    if (gate instanceof DynamicGate) {
      throw new ConfigurationError(`Gate "${ref}": session gates cannot be request-resolved (dynamic).`);
    }
    return gate;
  }
  async function resolveGate(ref, request) {
    if (ref instanceof Gate) return ref;
    if (ref instanceof DynamicGate) return await ref.resolve(request);
    if (ref instanceof Price) return Gate.create({ amount: ref, name: "inline" }, defaults);
    if (typeof ref === "string") {
      if (!pricing) {
        throw new ConfigurationError(
          `Gate "${ref}" referenced by name but no pricing catalogue was passed to createPayKit().`
        );
      }
      const gate = pricing.gate(ref);
      return gate instanceof DynamicGate ? await gate.resolve(request) : gate;
    }
    const result = await ref(request);
    const params = result instanceof Price ? { amount: result } : result;
    return Gate.create({ ...params, name: "inline" }, defaults);
  }
  function render402(challenge, body) {
    return new Response(JSON.stringify(body), {
      headers: { ...challenge.headers, "content-type": "application/json" },
      status: 402
    });
  }
  function granted(payment, settle, charge3) {
    return {
      charge: charge3,
      payment,
      settle,
      status: 200,
      async withSettlement(response) {
        const headers = new Headers(response.headers);
        for (const [name, value] of Object.entries(await settle())) headers.set(name, value);
        return new Response(response.body, {
          headers,
          status: response.status,
          statusText: response.statusText
        });
      }
    };
  }
  async function requireFixed(gate, request) {
    const eligible = adapters.filter((adapter) => gate.accepts(adapter.protocol));
    if (eligible.length === 0) {
      throw new ConfigurationError(
        `Gate "${gate.name}" accepts [${gate.accept.join(", ")}] but no matching adapter is configured.`
      );
    }
    const buildChallenge = async () => {
      const headers = {};
      const accepts = [];
      for (const adapter of eligible) {
        accepts.push(await adapter.acceptsEntry(gate, request));
        Object.assign(headers, await adapter.challengeHeaders(gate, request));
      }
      return { accepts, headers, resource: new URL(request.url).pathname };
    };
    const htmlRespond = async () => {
      const url = new URL(request.url);
      const wantsHtml = (request.headers.get("accept") ?? "").includes("text/html");
      const isWorker = url.searchParams.has("__mppx_worker") || url.searchParams.has("__mpp_worker");
      if (!wantsHtml && !isWorker) return void 0;
      for (const adapter of eligible) {
        const respond = await adapter.respond?.(gate, request);
        if (respond) return { respond };
      }
      return void 0;
    };
    const claimed = eligible.find((adapter) => adapter.detect(request));
    if (!claimed) {
      const html = await htmlRespond();
      if (html) return html;
      const challenge = await buildChallenge();
      return { challenge, response: render402(challenge, { accepts: challenge.accepts }), status: 402 };
    }
    try {
      const payment = await claimed.verifyAndSettle(gate, request);
      payments.set(request, payment);
      return granted(payment, () => Promise.resolve(payment.settlementHeaders));
    } catch (error) {
      if (!(error instanceof InvalidProofError)) throw error;
      const html = await htmlRespond();
      if (html) return html;
      const challenge = await buildChallenge();
      return {
        challenge,
        response: render402(challenge, {
          accepts: challenge.accepts,
          code: error.code,
          ...error.message !== error.code ? { detail: error.message } : {}
        }),
        status: 402
      };
    }
  }
  async function requireUsage(gate, request) {
    if (!upto) {
      throw new ConfigurationError(`Usage gate "${gate.name}" requires x402 in accept.`);
    }
    const usageChallenge = async (error) => {
      const requirements = await upto.accepts(gate.amount);
      const accepts = requirements.map((req) => ({ ...req, protocol: "x402" }));
      const challenge = {
        accepts,
        headers: await upto.challengeHeaders(gate.amount, request, requirements),
        resource: new URL(request.url).pathname
      };
      return {
        challenge,
        response: render402(challenge, {
          accepts,
          ...error ? { code: error.code, ...error.message !== error.code ? { detail: error.message } : {} } : {}
        }),
        status: 402
      };
    };
    if (!upto.detect(request)) return await usageChallenge();
    let verified;
    try {
      verified = await upto.verifyOpen(request, gate.amount);
    } catch (error) {
      if (error instanceof InvalidProofError) return await usageChallenge(error);
      throw error;
    }
    const channelId = verified.payload.payload.channelId;
    if (channelId !== void 0) {
      if (inFlightUptoChannels.has(channelId)) {
        return await usageChallenge(
          new InvalidProofError("upto_channel_in_flight", "channel already being served")
        );
      }
      inFlightUptoChannels.add(channelId);
    }
    const meter = new Charge(verified.maxBaseUnits);
    charges.set(request, meter);
    const provisional = {
      gateName: gate.name,
      payer: verified.payer || void 0,
      protocol: "x402",
      raw: void 0,
      scheme: "upto",
      settlementHeaders: {},
      transaction: ""
    };
    payments.set(request, provisional);
    let settlePromise;
    const settle = () => settlePromise ??= (async () => {
      try {
        const result = await upto.settle(verified, meter.settledBaseUnits());
        payments.set(request, { ...provisional, transaction: result.transaction });
        return result.settlementHeaders;
      } finally {
        if (channelId !== void 0) inFlightUptoChannels.delete(channelId);
      }
    })();
    return granted(provisional, settle, meter);
  }
  const SESSION_RECEIPT_HEADERS = ["payment-receipt", "x-payment-settlement-signature"];
  async function requireSession(gate, request) {
    const engine = sessionEngineFor(gate);
    const result = await engine.handler(request);
    if (result.status === 402) {
      return {
        challenge: { accepts: [], headers: {}, resource: new URL(request.url).pathname },
        response: result.challenge,
        status: 402
      };
    }
    const sealed = result.withReceipt(new Response(null));
    const settlementHeaders = {};
    for (const name of SESSION_RECEIPT_HEADERS) {
      const value = sealed.headers.get(name);
      if (value) settlementHeaders[name] = value;
    }
    const payment = {
      gateName: gate.name,
      payer: void 0,
      protocol: "mpp",
      raw: request.headers.get("authorization") ?? void 0,
      scheme: "session",
      settlementHeaders,
      transaction: ""
    };
    payments.set(request, payment);
    return granted(payment, () => Promise.resolve(settlementHeaders));
  }
  const intentFor = (gate) => gate.kind === "subscription" ? "subscription" : gate.kind === "session" ? "session" : "charge";
  async function offersForGate(gate, request) {
    const coin = resolveCoin(gate.amount, config.stablecoins);
    const intent = intentFor(gate);
    const toOffer = (entry, max) => {
      const extra = entry.extra ?? {};
      const feePayer = extra.feePayer ?? entry.feePayer;
      return {
        amount: entry.amount,
        currency: typeof entry.currency === "string" ? entry.currency : coin,
        description: `${max ? "up to " : ""}${gate.total().amount} ${coin}`,
        ...typeof feePayer === "string" ? { feePayer } : {},
        intent,
        method: entry.protocol,
        network: entry.network,
        payTo: entry.payTo,
        scheme: entry.scheme,
        ...gate.subscription ? { planId: gate.subscription.planId } : {}
      };
    };
    if (gate.kind === "usage") {
      if (!upto) return [];
      try {
        return (await upto.accepts(gate.amount)).map((req) => toOffer({ ...req, protocol: "x402" }, true));
      } catch {
        return [];
      }
    }
    if (gate.kind === "session") {
      return [
        {
          amount: gate.amount.baseUnits().toString(),
          currency: coin,
          description: `up to ${gate.total().amount} ${coin}`,
          intent,
          method: "mpp",
          network: caip2(config.network),
          payTo: gate.payTo,
          scheme: "session",
          ...gate.session ? { unitPrice: gate.session.unitPrice.toString() } : {}
        }
      ];
    }
    const eligible = adapters.filter((adapter) => gate.accepts(adapter.protocol));
    return await Promise.all(
      eligible.map(async (adapter) => toOffer(await adapter.acceptsEntry(gate, request), false))
    );
  }
  async function openapiDoc(routes2, options2) {
    const request = new Request("http://localhost/");
    const docRoutes = [];
    for (const route of routes2) {
      const gate = await resolveGate(route.gate, request);
      docRoutes.push({
        method: route.method,
        offers: await offersForGate(gate, request),
        path: route.path,
        summary: route.summary ?? gate.description,
        ...route.requestBody ? { requestBody: route.requestBody } : {}
      });
    }
    return buildOpenApiDocument({ info: options2?.info, routes: docRoutes, serviceInfo: options2?.serviceInfo });
  }
  const instance = {
    charge(request) {
      return charges.get(request);
    },
    config,
    express(gate) {
      const middleware = async (req, res, next) => {
        let result;
        try {
          result = await instance.requirePayment(toWebRequest(req), gate);
        } catch (error) {
          next(error);
          return;
        }
        if ("respond" in result) {
          await sendResponse(res, result.respond);
          return;
        }
        if (result.status === 402) {
          await sendResponse(res, result.response);
          return;
        }
        payments.set(req, result.payment);
        if (result.charge) charges.set(req, result.charge);
        if (!result.charge) {
          for (const [name, value] of Object.entries(await result.settle())) res.setHeader(name, value);
          next();
          return;
        }
        await runBufferedSettle(res, next, result, handleSettleFailure);
      };
      return Object.assign(middleware, { [GATE_METADATA]: gate });
    },
    fetch(gate, handler) {
      return async (request) => {
        const result = await instance.requirePayment(request, gate);
        if ("respond" in result) return result.respond;
        if (result.status === 402) return result.response;
        let response;
        try {
          response = await handler(request, result.payment);
        } catch (error) {
          try {
            await result.settle();
          } catch (settleError) {
            handleSettleFailure(settleError);
          }
          throw error;
        }
        try {
          return await result.withSettlement(response);
        } catch (settleError) {
          handleSettleFailure(settleError);
          return response;
        }
      };
    },
    hono(gate) {
      return async (c, next) => {
        const result = await instance.requirePayment(c.req.raw, gate);
        if ("respond" in result) return result.respond;
        if (result.status === 402) return result.response;
        try {
          await next();
        } finally {
          try {
            for (const [name, value] of Object.entries(await result.settle()))
              c.res.headers.set(name, value);
          } catch (settleError) {
            handleSettleFailure(settleError);
          }
        }
        return void 0;
      };
    },
    openapi(routes2, options2) {
      return openapiDoc(routes2, options2);
    },
    openapiFromExpress(app, options2) {
      return openapiDoc(introspectExpressRoutes(app), options2);
    },
    paid(request, gate) {
      const payment = payments.get(request);
      return payment !== void 0 && (gate === void 0 || payment.gateName === gate);
    },
    payment(request) {
      return payments.get(request);
    },
    async requirePayment(request, ref) {
      const gate = await resolveGate(ref, request);
      if (gate.kind === "usage") return await requireUsage(gate, request);
      if (gate.kind === "session") return await requireSession(gate, request);
      return await requireFixed(gate, request);
    },
    sessionRoutes(gate) {
      const engine = sessionEngineFor(resolveStaticGate(gate));
      const withBody = (req) => {
        const base = toWebRequest(req);
        return req.body === void 0 ? base : new Request(base, { body: JSON.stringify(req.body), method: base.method });
      };
      const json = (res, status, body) => {
        res.statusCode = status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(body));
      };
      return {
        async commit(req, res) {
          await sendResponse(res, await engine.commit(withBody(req)));
        },
        async deliveries(req, res) {
          await sendResponse(res, await engine.deliveries(withBody(req)));
        },
        async receipt(req, res) {
          const channelId = req.params?.channelId;
          if (typeof channelId !== "string" || channelId.length === 0) {
            json(res, 400, { error: "invalid-channel-id" });
            return;
          }
          const state = await engine.receipt(channelId);
          if (!state) {
            json(res, 404, { error: "channel-not-found" });
            return;
          }
          json(res, 200, state);
        },
        async voucher(req, res) {
          const result = await engine.handler(toWebRequest(req));
          if (result.status === 402) {
            await sendResponse(res, result.challenge);
            return;
          }
          const body = req.body ?? {};
          const ack = Response.json({
            amount: body.amount ?? "0",
            deliveryId: body.deliveryId ?? "",
            status: "committed"
          });
          await sendResponse(res, result.withReceipt(ack));
        }
      };
    }
  };
  return instance;
}
function warnSettleFailure(error) {
  console.warn("[pay-kit] settlement failed; serving the response without settlement headers.", error);
}
async function runBufferedSettle(res, next, result, handleSettleFailure) {
  const originalWriteHead = res.writeHead.bind(res);
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  let bufferedCalls = [];
  let settled = false;
  let signalEnd = () => {
  };
  const ended = new Promise((resolve) => {
    signalEnd = resolve;
  });
  res.writeHead = function(...args) {
    if (!settled) {
      bufferedCalls.push(["writeHead", args]);
      return res;
    }
    return originalWriteHead(...args);
  };
  res.write = function(...args) {
    if (!settled) {
      bufferedCalls.push(["write", args]);
      return true;
    }
    return originalWrite(...args);
  };
  res.end = function(...args) {
    if (!settled) {
      bufferedCalls.push(["end", args]);
      signalEnd();
      return res;
    }
    return originalEnd(...args);
  };
  const restoreAndReplay = () => {
    settled = true;
    res.writeHead = originalWriteHead;
    res.write = originalWrite;
    res.end = originalEnd;
    for (const [method, args] of bufferedCalls) {
      if (method === "writeHead") originalWriteHead(...args);
      else if (method === "write") originalWrite(...args);
      else originalEnd(...args);
    }
    bufferedCalls = [];
  };
  try {
    next();
  } catch (error) {
    restoreAndReplay();
    try {
      await result.settle();
    } catch (settleError) {
      handleSettleFailure(settleError);
    }
    next(error);
    return;
  }
  await ended;
  try {
    for (const [name, value] of Object.entries(await result.settle())) res.setHeader(name, value);
  } catch (settleError) {
    handleSettleFailure(settleError);
  }
  restoreAndReplay();
}

// src/index.ts
import { Store as Store4 } from "mppx";
export {
  ChallengeExpiredError,
  Charge,
  ConfigurationError,
  DemoSignerOnMainnetError,
  DynamicGate,
  Gate,
  InvalidKeyError,
  InvalidProofError,
  MixedCurrenciesError,
  PayKitError,
  PaymentRequiredError,
  Price,
  Pricing,
  ProtocolIncompatibleError,
  ProtocolNotSupportedError,
  STABLECOINS,
  Signer,
  Store4 as Store,
  UnknownGateError,
  X402Upto,
  buildOpenApiDocument,
  caip2,
  configure,
  configureFromEnv,
  createPayKit,
  createPricing,
  eur,
  gateDefaults,
  gbp,
  introspectExpressRoutes,
  session3 as session,
  subscription3 as subscription,
  toNetwork,
  toSolanaNetwork,
  usage,
  usd
};
//# sourceMappingURL=index.js.map