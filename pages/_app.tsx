import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <title>Rule-based Prompt Suite</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
      </Head>
      {/* 余白の原因だったラッパーを撤去し、そのままページを描画 */}
      <Component {...pageProps} />
    </>
  );
}