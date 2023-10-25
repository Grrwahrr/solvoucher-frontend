import {FC, useCallback, useEffect, useState} from 'react';
import {useAnchorWallet, useConnection, useWallet} from '@solana/wallet-adapter-react';
import {TransactionSignature} from "@solana/web3.js";
import {
    deriveConfig,
    deriveVoucher,
    deriveOwnerToVoucher,
    notifyTxError,
    notifyTxSuccess,
    solVoucherProgram
} from "../solana";
import {notify} from "../utils/notifications";
import {sha256} from "js-sha256";
import {bs58} from "@coral-xyz/anchor/dist/cjs/utils/bytes";

const COLLECTION_NAME: string = "ua_film_festival";

const emptyQuestions = {
    q1: "",
    q2: "",
    q3: "",
    q4: "",
    q5: "",
    q6: "",
    q7: "",
    q8: "",
    q9: "",
};


export const MintView: FC = () => {
    const {connection} = useConnection();
    const {publicKey} = useWallet();
    const anchorWallet = useAnchorWallet();

    // Views: init, editConfig, questionnaire
    const [view, setView] = useState<String>("loading");
    const [config, setConfig] = useState<any>({exists: false});
    const [editorQuestions, setEditorQuestion] = useState<any>(emptyQuestions);




    useEffect(() => {
        const fetchData = async () => {
            if (!publicKey) {
                return;
            }

            console.log("Loading collection config...");
            const program = solVoucherProgram(connection, anchorWallet);
            const [accDataConfig, bump] = deriveConfig(program, COLLECTION_NAME);

            // Try to load the collections config account
            try {
                const onChainConfig = await program.account.config.fetch(accDataConfig);
                setConfig({exists: true, admin: onChainConfig.admin.toString()});
            } catch (e) {
                setView("init");
                return;
            }

            setView("questionnaire");
        }
        fetchData().catch(console.error);
    }, [connection, publicKey, anchorWallet]);

    const btnSaveConfig = useCallback(async (newSate?: any) => {
        console.log("Running Save Config");
        const program = solVoucherProgram(connection, anchorWallet);
        const [accDataConfig, bump] = deriveConfig(program, COLLECTION_NAME);

        // Attempt to load the config account
        let onChainConfig = undefined;
        try { onChainConfig = await program.account.config.fetch(accDataConfig); } catch (error: any) {}

        if (onChainConfig) {
            let tx: TransactionSignature = '';
            try {
                tx = await program.methods
                    .configUpdate(COLLECTION_NAME, newSate)
                    .accounts({
                        payer: publicKey,
                        config: accDataConfig,
                    }).rpc();
                notifyTxSuccess("Config was updated", tx);
            } catch (error: any) {
                notifyTxError("Could not update config", error, tx);
            }
        } else {
            let tx: TransactionSignature = '';
            try {
                tx = await program.methods
                    .configInitialize(COLLECTION_NAME)
                    .accounts({
                        payer: publicKey,
                        config: accDataConfig,
                    }).rpc();
                notifyTxSuccess("Config was created", tx);
                setConfig({...config, exists: true});
                setView("events");
            } catch (error: any) {
                notifyTxError("Could not create config", error, tx);
            }
        }
    }, [publicKey, connection, config]);

    const btnSubmitAnswers = useCallback(async () => {
        // Build the data we wish to store
        let data = "";
        for (const prop in editorQuestions) {
            data += editorQuestions[prop] !== "" ? editorQuestions[prop] : "0";
        }

        console.log("Running Submit Answers with data: ", data);

        const program = solVoucherProgram(connection, anchorWallet);
        const [accDataConfig, bump] = deriveConfig(program, COLLECTION_NAME);

        // Attempt to load the config account
        let onChainConfig = undefined;
        try { onChainConfig = await program.account.config.fetch(accDataConfig); } catch (error: any) {}
        // console.log("DEBUG current config: ", onChainConfig);

        // Check some required conditions before continuing
        if (!onChainConfig) {
            notify({type: 'error', message: "Not currently found", description: "", txid: ""});
            return;
        }
        if ( JSON.stringify(onChainConfig.state) !== JSON.stringify({minting: {}}) ) {
            notify({type: 'error', message: "Not currently enabled", description: "", txid: ""});
            return;
        }

        // Generate the voucher PDAs
        const [accVoucher, bumpVoucher] = deriveVoucher(program, COLLECTION_NAME, onChainConfig.vouchers_minted);
        const [accOwnerToVoucher, bumpOwnerToVoucher] = deriveOwnerToVoucher(program, COLLECTION_NAME, publicKey);

        let tx: TransactionSignature = '';
        try {
            tx = await program.methods
                .voucherMint(COLLECTION_NAME, data)
                .accounts({
                    payer: publicKey,
                    config: accDataConfig,
                    voucher: accVoucher,
                    ownerToVoucher: accOwnerToVoucher,
                }).rpc();
            notifyTxSuccess("Success! Your answers were recorded!", tx);
        } catch (error: any) {
            notifyTxError("That did not work. Please try again.", error, tx);
        }
    }, [publicKey, connection, config, editorQuestions]);

    const btnDumpAnswers = useCallback(async () => {
        console.log("Running Dump Answers");

        const program = solVoucherProgram(connection, anchorWallet);
        const discriminator = Buffer.from(sha256.digest("account:Voucher")).subarray(0, 8)
        const filter = { memcmp: { offset: 0,
                bytes: bs58.encode(discriminator)
            }
        }
        const accounts = await connection.getProgramAccounts(program.programId, { filters: [filter] })
        let i = 0;
        for (const acc of accounts) {
            i++;
            let slice = acc.account.data.slice(44,53);
            console.log("ACCOUNT ", i, ": ", slice.toString());
        }

    }, [publicKey, connection, config]);


    const createConfigHero = () => {
        return (
            <>
            <div className="md:hero-content flex flex-col">
                <h1 className="text-center text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mt-10 mb-8">
                    Setup a collection
                </h1>
                <div className="w-full items-center">
                    <div className="hero h-50 bg-base-300 w-full md:w-4/5 m-auto rounded-xl">
                        <div className="hero-content text-center">
                            <div className="max-w-md">
                                <p className="py-6">This collection does not yet exist.
                                    Click here to create it.</p>
                                <button className="btn btn-primary"
                                        onClick={btnSaveConfig}>Create Collection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </>
        );
    }

    const showMainView = () => {
        return (
            <>
                <div className="p-5">
                    <h1 className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mt-10 mb-8">
                        Hello there, Ukrainian Film Festival enthusiast!
                    </h1>
                </div>
                <div className="p-5 mx-auto w-full md:w-4/5">
                    <p>
                        Participate in the future of the Ukrainian Film Festival Berlin! Help us create the perfect membership NFT collection by telling us how you feel about the following use-cases. Submitting your answers will guarantee your ability to mint our membership NFT when it launches next year! As a holder of the Ukrainian Film Festival Berlin NFT, how would you feel about the following benefits...
                    </p>

                    {view === "questionnaire" ? showQuestionnaire() : ""}

                    {config !== undefined && config.admin == publicKey ? showEditConfig() : ""}
                </div>
            </>
        );
    }

    const showQuestionnaire = () => {
        return (
            <div className="pt-5 mt-5 border-t-4 border-indigo-500">
                <div className="">
                    <label htmlFor="q1" className="block mt-5 mb-2 text-sm font-medium">
                        Q1: Exclusive film screenings? <p>Q1 answer: {answerToText(editorQuestions.q1)}</p>
                    </label>
                    <input id="q1" name="q1" onChange={handleQuestionChange} value={editorQuestions.q1} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q2" className="block mt-8 mb-2 text-sm font-medium">
                        Q2: Opportunities to meet with directors or actors? <p>Q2 answer: {answerToText(editorQuestions.q2)}</p>
                    </label>
                    <input id="q2" name="q2" onChange={handleQuestionChange} value={editorQuestions.q2} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q3" className="block mt-8 mb-2 text-sm font-medium">
                        Q3: Special merchandise such as limited edition festival T-shirts, posters, or collectibles? <p>Q3 answer: {answerToText(editorQuestions.q3)}</p>
                    </label>
                    <input id="q3" name="q3" onChange={handleQuestionChange} value={editorQuestions.q3} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q4" className="block mt-8 mb-2 text-sm font-medium">
                        Q4: Discounts for future festivals? <p>Q4 answer: {answerToText(editorQuestions.q4)}</p>
                    </label>
                    <input id="q4" name="q4" onChange={handleQuestionChange} value={editorQuestions.q4} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q5" className="block mt-8 mb-2 text-sm font-medium">
                        Q5: Access to online streams of movies? <p>Q5 answer: {answerToText(editorQuestions.q5)}</p>
                    </label>
                    <input id="q5" name="q5" onChange={handleQuestionChange} value={editorQuestions.q5} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q6" className="block mt-8 mb-2 text-sm font-medium">
                        Q6: Early access to NFT collections created in collaboration with Ukrainian artists? <p>Q6 answer: {answerToText(editorQuestions.q6)}</p>
                    </label>
                    <input id="q6" name="q6" onChange={handleQuestionChange} value={editorQuestions.q6} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <label htmlFor="q7" className="block mt-8 mb-2 text-sm font-medium">
                        Q7: Access to commemorative limited edition NFTs for the festival, such as unique artwork, clips from featured films, etc.? <p>Q7 answer: {answerToText(editorQuestions.q7)}</p>
                    </label>
                    <input id="q7" name="q7" onChange={handleQuestionChange} value={editorQuestions.q7} placeholder="5" type="range" min="1" max="9" className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer " />

                    <div className="mt-10 text-center">
                        <div className="m-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-lg blur opacity-20 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                        <button
                            className="group w-60 m-2 btn animate-pulse bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-white hover:to-purple-300 text-black"
                            onClick={btnSubmitAnswers} disabled={!publicKey}
                        >
                            <div className="hidden group-disabled:block">Wallet not connected</div>
                            <span className="block group-disabled:hidden" >Submit & Register</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const answerToText = (answer) => {
        switch (answer) {
            case "1": return <>Extremely negative</>
            case "2": return <>Very negative</>
            case "3": return <>Fairly negative</>
            case "4": return <>Slightly negative</>
            case "5": return <>No opinion</>
            case "6": return <>Slightly positive</>
            case "7": return <>Fairly positive</>
            case "8": return <>Very positive</>
            case "9": return <>Extremely positive</>
        }
        return <>(Adjust the slider below)</>
    };

    const handleQuestionChange = (e) => {
        let {name, value} = e.target;
        setEditorQuestion({...editorQuestions, [name]: value});
    };

    const showEditConfig = () => {
        return <div className="pt-5 mt-5 border-t-4 border-indigo-500">
            As the admin, you can update the config state:
            <div className="py-1"><button className="btn btn-md bg-blue-700 hover:bg-blue-800" onClick={()=>btnSaveConfig({inactive: {}})}>Set inactive</button></div>
            <div className="py-1"><button className="btn btn-md bg-green-700 hover:bg-green-800" onClick={()=>btnSaveConfig({minting: {}})}>Set minting</button></div>
            <div className="py-1"><button className="btn btn-md bg-yellow-700 hover:bg-yellow-800" onClick={()=>btnSaveConfig({burning: {}})}>Set burning</button></div>

            <div className="py-1"><button className="btn btn-md bg-grey-700 hover:bg-grey-800" onClick={btnDumpAnswers}>Dump recorded answers</button></div>
        </div>
    }
    //TODO: add admin func to show list of votes
    //TODO: add admin func to burn accounts
    //TODO: add admin func to burn config

    const showSpinner = () => {
        return             <>
            <div className="p-5">
                <h1 className="text-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-fuchsia-500 mt-10 mb-8">
                    Hello there, Ukrainian Film Festival enthusiast!
                </h1>
            </div>
            <div className="p-5 mx-auto w-full md:w-4/5">
                <p>
                    In order to register your interest in the member NFT of the Ukrainian Film Festival Berlin, you will need to have a Solana wallet installed. This can be done on Android and Apple iOS devices as well as Firefox and Chrome browsers. Two common options include <a target="blank" href={"https://phantom.app"} className="text-blue-600 dark:text-purple-500 hover:underline">Phantom</a>, <a target="blank" href={"https://ultimate.app"} className="text-blue-600 dark:text-purple-500 hover:underline">Ultimate</a> and <a target="blank" href={"https://solflare.com"} className="text-blue-600 dark:text-purple-500 hover:underline">Solflare</a>. Once you have a wallet installed, click the <span className="text-blue-600 dark:text-purple-500">Select Wallet</span> at the top of the screen.
                    <br/>
                    If you need assistance, find one of our knowledgeable helpers at the Festivals after party on Saturday.
                </p>
            </div>
            <div className="text-center"><button className="btn loading">Please connect a wallet!</button></div>
        </>
    }

    return <>
        {view === "loading" ? showSpinner() : ""}
        {view !== "loading" && !config.exists ? createConfigHero() : ''}
        {view !== "loading" && config.exists ? showMainView() : ''}
    </>
};
