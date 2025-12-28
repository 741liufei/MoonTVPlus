/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 解析影视仓订阅链接
 * 支持解析TVBOX格式的订阅配置
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: '请提供订阅链接' },
        { status: 400 }
      );
    }

    // 获取订阅内容
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `获取订阅失败: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    let subscriptionData: any;

    // 尝试解析JSON
    if (contentType.includes('application/json')) {
      subscriptionData = await response.json();
    } else {
      const text = await response.text();
      try {
        subscriptionData = JSON.parse(text);
      } catch (e) {
        return NextResponse.json(
          { error: '订阅内容不是有效的JSON格式' },
          { status: 400 }
        );
      }
    }

    // 解析视频源站点
    const sites = subscriptionData.sites || [];
    const parsedSites = sites
      .filter((site: any) => site.type === 1) // 只保留视频源，type=1表示视频源
      .map((site: any) => {
        // 提取原始API地址（去除可能的代理）
        let apiUrl = site.api || '';

        // 如果API包含代理参数，尝试提取原始地址
        if (apiUrl.includes('/api/cms-proxy?api=')) {
          try {
            const urlObj = new URL(apiUrl);
            const originalApi = urlObj.searchParams.get('api');
            if (originalApi) {
              apiUrl = decodeURIComponent(originalApi);
            }
          } catch (e) {
            // 如果解析失败，保持原样
          }
        }

        return {
          name: site.name || '',
          key: site.key || '',
          api: apiUrl,
          detail: site.ext || '',
        };
      })
      .filter((site: any) => site.api && site.name); // 过滤掉无效的站点

    // 解析直播源
    const lives = subscriptionData.lives || [];
    const parsedLives = lives.map((live: any) => ({
      name: live.name || '',
      url: live.url || '',
      epg: live.epg || '',
      ua: live.ua || '',
    })).filter((live: any) => live.url && live.name);

    return NextResponse.json({
      success: true,
      data: {
        sites: parsedSites,
        lives: parsedLives,
        totalSites: parsedSites.length,
        totalLives: parsedLives.length,
      },
    });
  } catch (error) {
    console.error('解析订阅失败:', error);
    return NextResponse.json(
      {
        error: '解析订阅失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
