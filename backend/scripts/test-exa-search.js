// Test script for Exa search via Metorial
// Run with: bun test-exa-search.js

const { Metorial } = require('metorial');

const metorial = new Metorial({
  apiKey: process.env.METORIAL_API_KEY || 'metorial_sk_faxKQdoTX0I6VeG8iPs5D0WxTNIwHCQ3kSvUC59pti4iUw2V12KB98JVByZn4bnX7G6OgTddJPq0hGQhkrWQVzwyi66DZo7ZT3v1',
});

async function testExaSearch() {
  const testQuery = 'Find 5 hair salons in San Francisco with same-day appointments';
  
  console.log('🔍 Testing Exa search via Metorial...');
  console.log(`Query: ${testQuery}\n`);

  try {
    const results = await metorial.mcp.withSession(
      {
        serverDeployments: ['svd_0mhhcb7z0wvg34K6xJugat'],
      },
      async (session) => {
        const toolManager = await session.getToolManager();
        
        console.log('📋 Available tools:', toolManager.getTools().map(t => t.name));
        console.log('\n🔧 Calling exa-search tool...\n');
        
        const response = await toolManager.callTool('exa-search', {
          query: testQuery,
          type: 'neural',
          num_results: 5,
          use_autoprompt: true,
          contents: {
            text: true,
            highlights: true,
          },
        });

        return response;
      }
    );

    console.log('✅ Search successful!\n');
    console.log('📊 Results:');
    console.log(JSON.stringify(results, null, 2));
    
    // Pretty print if results have a specific structure
    if (results?.results || results?.data?.results) {
      const exaResults = results.results || results.data.results;
      console.log(`\n📈 Found ${exaResults.length} results:\n`);
      exaResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title || 'No title'}`);
        console.log(`   URL: ${result.url || 'No URL'}`);
        if (result.highlights) {
          console.log(`   Highlights: ${result.highlights.slice(0, 2).join('... ')}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

testExaSearch();

