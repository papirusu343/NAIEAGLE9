import React, { ReactNode } from 'react';
import Head from 'next/head';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children, title = 'NovelAI Image Generator' }: LayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="NovelAI V4.5対応画像生成アプリ" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen bg-gray-900">
        <header className="border-b border-gray-700 bg-gray-800">
          {/* 上側の余白をさらに控えめにして微妙な隙間を解消 */}
          <div className="container mx-auto px-3 pt-1 pb-2 sm:px-4 sm:pt-2 sm:pb-3">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold text-gray-100 leading-tight">
              NovelAI Image Generator V4.5
            </h1>
          </div>
        </header>
        <main className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
          {children}
        </main>
      </div>
    </>
  );
}