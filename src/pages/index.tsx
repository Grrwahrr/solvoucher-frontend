import type { NextPage } from "next";
import Head from "next/head";
import {MintView} from "../views/mint";

const Home: NextPage = (props) => {
  return (
    <div>
      <Head>
        <title>Ukrainian Film Festival Berlin</title>
        <meta
          name="description"
          content="Ukrainian Film Festival Berlin - NFT Voucher"
        />
      </Head>
      <MintView/>
    </div>
  );
};

export default Home;
