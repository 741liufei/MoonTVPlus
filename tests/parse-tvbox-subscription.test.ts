/**
 * TVBOX订阅源解析测试
 * 用于测试解析影视仓订阅链接，提取视频源API地址
 */

interface TVBoxSite {
  key: string;
  name: string;
  type: number;
  api: string;
  searchable?: number;
  quickSearch?: number;
  filterable?: number;
  ext?: string;
}

interface TVBoxSubscription {
  spider?: string;
  wallpaper?: string;
  sites: TVBoxSite[];
  lives?: any[];
  parses?: any[];
  rules?: any[];
  ads?: any[];
}

interface ParsedSite {
  name: string;
  key: string;
  api: string;
  detail?: string;
}

/**
 * 解析TVBOX订阅数据
 */
function parseTVBoxSubscription(data: TVBoxSubscription): ParsedSite[] {
  const sites = data.sites || [];

  const parsedSites = sites
    .filter((site) => site.type === 1) // 只保留视频源，type=1表示视频源
    .map((site) => {
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
    .filter((site) => site.api && site.name); // 过滤掉无效的站点

  return parsedSites;
}

/**
 * 从URL获取订阅数据
 */
async function fetchSubscription(url: string): Promise<TVBoxSubscription> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`获取订阅失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  let subscriptionData: TVBoxSubscription;

  // 尝试解析JSON
  if (contentType.includes('application/json')) {
    subscriptionData = await response.json();
  } else {
    const text = await response.text();
    try {
      subscriptionData = JSON.parse(text);
    } catch (e) {
      throw new Error('订阅内容不是有效的JSON格式');
    }
  }

  return subscriptionData;
}

/**
 * 主测试函数
 */
async function testParseSubscription(subscriptionUrl: string) {
  console.log('='.repeat(80));
  console.log('开始解析TVBOX订阅源');
  console.log('订阅地址:', subscriptionUrl);
  console.log('='.repeat(80));
  console.log();

  try {
    // 获取订阅数据
    console.log('正在获取订阅数据...');
    const subscriptionData = await fetchSubscription(subscriptionUrl);
    console.log('✓ 订阅数据获取成功');
    console.log();

    // 解析视频源
    console.log('正在解析视频源...');
    const parsedSites = parseTVBoxSubscription(subscriptionData);
    console.log(`✓ 解析完成，共找到 ${parsedSites.length} 个视频源`);
    console.log();

    // 输出结果
    console.log('='.repeat(80));
    console.log('视频源列表（VOD API地址）');
    console.log('='.repeat(80));
    console.log();

    parsedSites.forEach((site, index) => {
      console.log(`${index + 1}. ${site.name}`);
      console.log(`   Key: ${site.key}`);
      console.log(`   API: ${site.api}`);
      if (site.detail) {
        console.log(`   Detail: ${site.detail}`);
      }
      console.log();
    });

    // 输出统计信息
    console.log('='.repeat(80));
    console.log('统计信息');
    console.log('='.repeat(80));
    console.log(`总视频源数量: ${parsedSites.length}`);
    console.log(`有Detail地址的源: ${parsedSites.filter(s => s.detail).length}`);
    console.log();

    // 输出为JSON格式（方便复制使用）
    console.log('='.repeat(80));
    console.log('JSON格式输出（可直接用于配置）');
    console.log('='.repeat(80));
    console.log(JSON.stringify(parsedSites, null, 2));

    return parsedSites;
  } catch (error) {
    console.error('❌ 解析失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// 导出函数供外部使用
export { testParseSubscription, parseTVBoxSubscription, fetchSubscription };

// 如果直接运行此文件
if (require.main === module) {
  // 从命令行参数获取订阅URL
  const subscriptionUrl = process.argv[2];

  if (!subscriptionUrl) {
    console.error('请提供订阅URL作为参数');
    console.error('用法: node parse-tvbox-subscription.test.js <订阅URL>');
    process.exit(1);
  }

  testParseSubscription(subscriptionUrl)
    .then(() => {
      console.log('\n✓ 解析完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 解析失败:', error);
      process.exit(1);
    });
}
