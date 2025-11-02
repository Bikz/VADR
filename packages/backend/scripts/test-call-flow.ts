#!/usr/bin/env bun

/**
 * Test script to verify the voice agent call flow
 * Simulates a complete call without actually calling Twilio
 */

import type { CallPrep, Lead } from '@vadr/shared';

const BASE_URL = 'http://localhost:3001';

// Test data
const testLead: Lead = {
  id: 'test-lead-1',
  name: 'Test Spa & Wellness',
  phone: '+16478258500', // Test phone from env
  rating: 4.5,
  reviewCount: 120,
  confidence: 0.9,
  address: '123 Test Street, San Francisco, CA',
  description: 'A premium spa offering massage and wellness services',
  source: 'test',
};

const testPrep: CallPrep = {
  objective: 'Schedule a demo of our spa booking software',
  script: `1. Greet and introduce VADR
2. Ask about their current booking system
3. Mention our automation features
4. Ask if they'd like a demo
5. Thank them and end call`,
  variables: {
    product_name: 'SpaBook Pro',
    demo_url: 'https://spabook.demo',
  },
  redFlags: ['not interested', 'already have a solution', 'too busy'],
  disallowedTopics: ['pricing', 'contracts', 'commitments'],
};

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function log(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: Start a call campaign
 */
async function testStartCalls() {
  console.log('\n📞 TEST 1: Starting Call Campaign\n');

  try {
    const response = await fetch(`${BASE_URL}/api/start-calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'San Francisco spas for booking software demo',
        leads: [testLead],
        prep: testPrep,
        createdBy: 'test-user',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      log('Start Calls', false, `Failed with status ${response.status}`, data);
      return null;
    }

    const callId = data.run?.calls?.[0]?.id;

    log('Start Calls', true, `Run created: ${data.runId}`, {
      runId: data.runId,
      callId,
      callCount: data.run?.calls?.length,
    });

    return { runId: data.runId, callId };
  } catch (error) {
    log('Start Calls', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Test 2: Simulate Twilio answering the call
 */
async function testOutboundAnswer(runId: string, callId: string) {
  console.log('\n🎙️  TEST 2: Simulating Call Answer\n');

  try {
    const response = await fetch(`${BASE_URL}/api/twilio/outbound?runId=${runId}&callId=${callId}`, {
      method: 'POST',
    });

    const twiml = await response.text();

    if (!response.ok) {
      log('Outbound Answer', false, `Failed with status ${response.status}`, twiml);
      return null;
    }

    const hasGather = twiml.includes('<Gather');
    const hasOpening = twiml.includes('VADR');
    const hasAction = twiml.includes('/api/twilio/gather');

    log('Outbound Answer', hasGather && hasOpening && hasAction, 'TwiML generated', {
      hasGather,
      hasOpening,
      hasAction,
      preview: twiml.substring(0, 200),
    });

    return twiml;
  } catch (error) {
    log('Outbound Answer', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Test 3: Simulate conversation turns
 */
async function testConversationTurns(runId: string, callId: string) {
  console.log('\n💬 TEST 3: Simulating Conversation\n');

  const conversationTurns = [
    "Yes, I have a moment. What's this about?",
    'We currently use a paper booking system. It works but could be better.',
    "That sounds interesting. I'd like to learn more about the automation features.",
    'What kind of reporting does it have?',
    'That sounds great! When can we schedule a demo?',
    "Perfect! I'll make sure our manager is available.",
  ];

  const conversationResults: any[] = [];

  for (let i = 0; i < conversationTurns.length; i++) {
    const userSpeech = conversationTurns[i];
    console.log(`\n   Turn ${i + 1}: User says: "${userSpeech}"\n`);

    try {
      // Simulate Twilio's form data
      const formData = new URLSearchParams({
        CallSid: `CA${Math.random().toString(36).substring(7)}`,
        SpeechResult: userSpeech,
        Confidence: '0.95',
      });

      const response = await fetch(`${BASE_URL}/api/twilio/gather?runId=${runId}&callId=${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const twiml = await response.text();

      if (!response.ok) {
        log(`Turn ${i + 1}`, false, `Failed with status ${response.status}`, twiml);
        continue;
      }

      const hasGather = twiml.includes('<Gather');
      const hasHangup = twiml.includes('<Hangup');
      const hasSay = twiml.includes('<Say');

      // Extract the agent's response
      const sayMatch = twiml.match(/<Say[^>]*>(.*?)<\/Say>/);
      const agentResponse = sayMatch ? sayMatch[1] : 'No response extracted';

      conversationResults.push({
        turn: i + 1,
        userSpeech,
        agentResponse,
        hasGather,
        hasHangup,
      });

      console.log(`   Agent responds: "${agentResponse}"`);

      if (hasHangup) {
        log(`Turn ${i + 1}`, true, 'Call terminated by agent', { agentResponse });
        log('Conversation Flow', true, `Conversation ended gracefully after ${i + 1} turns`);
        return conversationResults;
      }

      log(`Turn ${i + 1}`, hasSay, hasGather ? 'Continuing conversation' : 'Response generated');

      // Small delay between turns
      await sleep(500);
    } catch (error) {
      log(`Turn ${i + 1}`, false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      break;
    }
  }

  log('Conversation Flow', true, `Completed ${conversationTurns.length} conversation turns`, {
    totalTurns: conversationTurns.length,
  });

  return conversationResults;
}

/**
 * Test 4: Test max turn termination
 */
async function testMaxTurnTermination(runId: string, callId: string) {
  console.log('\n⏱️  TEST 4: Testing Max Turn Termination\n');

  try {
    // Make exactly MAX_CONVERSATION_TURNS (10) requests
    for (let i = 0; i < 11; i++) {
      const formData = new URLSearchParams({
        CallSid: `CA${Math.random().toString(36).substring(7)}`,
        SpeechResult: `Turn ${i + 1} speech`,
        Confidence: '0.95',
      });

      const response = await fetch(`${BASE_URL}/api/twilio/gather?runId=${runId}&callId=${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      const twiml = await response.text();
      const hasHangup = twiml.includes('<Hangup');

      if (hasHangup) {
        log('Max Turn Termination', true, `Call terminated at turn ${i + 1} as expected`, {
          turnNumber: i + 1,
          hasGoodbyeMessage: twiml.includes('Thank you'),
        });
        return true;
      }

      await sleep(200);
    }

    log('Max Turn Termination', false, 'Call did not terminate after 11 turns');
    return false;
  } catch (error) {
    log('Max Turn Termination', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Test 5: Test low confidence speech filtering
 */
async function testLowConfidenceSpeech(runId: string, callId: string) {
  console.log('\n🔊 TEST 5: Testing Low Confidence Speech Filtering\n');

  try {
    const formData = new URLSearchParams({
      CallSid: `CA${Math.random().toString(36).substring(7)}`,
      SpeechResult: 'This should be ignored',
      Confidence: '0.3', // Below MIN_SPEECH_CONFIDENCE (0.5)
    });

    const response = await fetch(`${BASE_URL}/api/twilio/gather?runId=${runId}&callId=${callId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const twiml = await response.text();
    const sayMatch = twiml.match(/<Say[^>]*>(.*?)<\/Say>/);
    const agentResponse = sayMatch ? sayMatch[1] : '';

    // Should use fallback reply since confidence is low
    const usedFallback = agentResponse.includes('Could you tell me more') || agentResponse.includes('share a bit more');

    log('Low Confidence Filtering', usedFallback, usedFallback ? 'Low confidence speech filtered correctly' : 'Low confidence speech was processed', {
      confidence: 0.3,
      agentResponse,
    });

    return usedFallback;
  } catch (error) {
    log('Low Confidence Filtering', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Test 6: Simulate call status callback
 */
async function testStatusCallback(runId: string, callId: string) {
  console.log('\n📊 TEST 6: Testing Status Callback\n');

  try {
    const formData = new URLSearchParams({
      CallSid: `CA${Math.random().toString(36).substring(7)}`,
      CallStatus: 'completed',
      CallDuration: '45',
      AnsweredBy: 'human',
    });

    const response = await fetch(`${BASE_URL}/api/twilio/status?runId=${runId}&callId=${callId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      log('Status Callback', false, `Failed with status ${response.status}`, text);
      return false;
    }

    log('Status Callback', true, 'Status callback processed successfully', {
      callStatus: 'completed',
      duration: 45,
    });

    return true;
  } catch (error) {
    log('Status Callback', false, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 VADR Voice Agent Call Flow Tests');
  console.log('=====================================\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // Test 1: Start calls
  const result1 = await testStartCalls();
  if (!result1) {
    console.log('\n❌ Cannot continue - call start failed\n');
    return;
  }

  const { runId, callId } = result1;

  await sleep(1000);

  // Test 2: Outbound answer
  await testOutboundAnswer(runId, callId);
  await sleep(1000);

  // Test 3: Conversation flow
  await testConversationTurns(runId, callId);
  await sleep(1000);

  // Test 4: Create fresh call for max turn test
  const result2 = await testStartCalls();
  if (result2) {
    await sleep(500);
    await testMaxTurnTermination(result2.runId, result2.callId);
  }
  await sleep(1000);

  // Test 5: Low confidence speech
  const result3 = await testStartCalls();
  if (result3) {
    await sleep(500);
    await testLowConfidenceSpeech(result3.runId, result3.callId);
  }
  await sleep(1000);

  // Test 6: Status callback
  await testStatusCallback(runId, callId);

  // Summary
  console.log('\n\n📈 TEST SUMMARY');
  console.log('=================\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.step}: ${r.message}`);
      });
  }

  console.log('\n');
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
