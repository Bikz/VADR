'use client';

import { PhoneCall, PhoneMissed, Voicemail, MapPin, Clock, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Call, CallState } from '@/types';

interface DemoCallCardProps {
  state: CallState;
  businessName: string;
  phone: string;
  duration: number;
  events: string[];
  price?: string;
  availability?: string;
  address?: string;
}

function getStatusColor(state: CallState): string {
  switch (state) {
    case 'dialing':
      return 'bg-[#FFC105]';
    case 'ringing':
      return 'bg-[#FFD557]';
    case 'connected':
      return 'bg-[#82EE71]';
    case 'voicemail':
      return 'bg-[#E8BB82]';
    case 'idle':
      return 'bg-[#EDD2B0]';
    case 'completed':
      return 'bg-[#90D3FF]';
    case 'failed':
      return 'bg-[#E99E9E]';
    default:
      return 'bg-[#EDD2B0]';
  }
}

function getStatusLabel(state: CallState): string {
  switch (state) {
    case 'dialing':
      return 'Dialing...';
    case 'ringing':
      return 'Dialing...';
    case 'connected':
      return '';
    case 'voicemail':
      return 'Voicemail';
    case 'idle':
      return 'Waiting';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Waiting';
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function DemoCallCard({ state, businessName, phone, duration, events, price, availability, address }: DemoCallCardProps) {
  const isSmallCard = state === 'dialing' || state === 'ringing' || state === 'idle';

  return (
    <div className={`flex-shrink-0 ${isSmallCard ? 'w-[514px] h-[216px]' : 'w-[514px] h-[380px]'} rounded-[39px] border-2 border-[#523429] overflow-hidden`}>
      <div className="h-[85px] rounded-t-[39px] bg-[#FEE9CF] border-b-2 border-[#523429] px-4 py-4 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-full border-2 border-[#523429] overflow-hidden bg-[#D4A574] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="#8B5E3C"/>
            </svg>
          </div>
          <div>
            <h3 className="font-inter text-[18px] font-bold text-[#513529] leading-tight">
              {businessName}
            </h3>
            <p className="font-inter text-[14px] font-normal text-[#513529]/50">
              {phone}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-inter text-[14px] font-medium text-[#513529]/50">
            {formatDuration(duration)}
          </span>
          <div className={`px-2 py-1 rounded-[42px] ${getStatusColor(state)} flex items-center justify-center min-w-[94px] ${state === 'dialing' || state === 'ringing' ? 'animate-shake' : ''}`}>
            <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
              {getStatusLabel(state)}
            </span>
          </div>
          {state === 'voicemail' && (
            <Voicemail className="w-5 h-5 text-[#523429]" />
          )}
          {state === 'failed' && (
            <PhoneMissed className="w-5 h-5 text-[#523429]" />
          )}
          {(state === 'connected' || state === 'completed') && (
            <PhoneCall className="w-5 h-5 text-[#523429]" />
          )}
        </div>
      </div>

      {!isSmallCard && (
        <div className="h-[calc(100%-85px)] bg-white flex flex-col">
          <div className="flex-1 px-4 py-4 overflow-y-auto">
            <div className="space-y-1">
              {events.map((event, index) => (
                <p key={index} className="font-inter text-[14px] font-normal text-[#513529]/50 leading-[150%]">
                  • {event}
                </p>
              ))}
            </div>

            {(price || availability || address) && (
              <>
                <div className="border-t border-[#523429] my-4" />
                <div className="space-y-1.5">
                  {price && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Price: {price}
                      </span>
                    </div>
                  )}
                  {availability && (
                    <div className="flex items-start gap-2">
                      <Clock className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Availability: {availability}
                      </span>
                    </div>
                  )}
                  {address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-[14px] h-[14px] text-[#523429] mt-0.5 flex-shrink-0" />
                      <span className="font-inter text-[14px] font-medium text-[#523429]">
                        Address: {address}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="border-t-2 border-[#523429] h-[1px]" />

          <div className="px-4 py-4 flex items-center justify-center gap-3">
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                View Transcript
              </span>
            </button>
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Cancel Call
              </span>
            </button>
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Mark Complete
              </span>
            </button>
          </div>
        </div>
      )}

      {isSmallCard && (
        <div className="h-[calc(216px-85px)] bg-white flex flex-col">
          <div className="flex-1 px-4 py-4">
            <p className="font-inter text-[14px] font-normal text-[#513529]/50 leading-[150%]">
              • 00:00  Tara called {businessName}
            </p>
          </div>
          <div className="px-4 py-4 flex items-center justify-center gap-3">
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                View Transcript
              </span>
            </button>
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Cancel Call
              </span>
            </button>
            <button className="h-[23px] px-2 rounded-md border border-[#523429] bg-[#EDD2B0]/40 hover:bg-[#EDD2B0]/60 transition-colors flex items-center justify-center">
              <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                Mark Complete
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const router = useRouter();
  const demoCards = [
    {
      state: 'dialing' as CallState,
      businessName: 'J&D Hair Studio',
      phone: '(929) 233-5437',
      duration: 0,
      events: ['00:00  Tara called J&D Hair Studio'],
    },
    {
      state: 'connected' as CallState,
      businessName: 'Downtown Cuts',
      phone: '(929) 233-5437',
      duration: 45,
      events: [
        '02:05  Rep checking available stylists',
        '01:45  Rep confirmed: walk-in available at 3:00 PM',
        '01:20  Quoted price $35 for haircut',
        '00:00  Tara connected to Downtown Cuts'
      ],
      price: '$35',
      availability: '3:00 PM',
      address: '245 Mission St, San Francisco',
    },
    {
      state: 'voicemail' as CallState,
      businessName: 'Style & Co',
      phone: '(929) 233-5437',
      duration: 15,
      events: [
        '00:10  Reached Voicemail',
        '00:00  Tara called Style & Co'
      ],
      address: '245 Mission St, San Francisco',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF5E5]">
      <div className="px-14 py-8">
        <button
          onClick={() => router.push('/')}
          className="mb-16 flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative h-[22px] w-[22px] flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="11" fill="#D4A574"/>
              <circle cx="11" cy="11" r="8.3" fill="#8B5E3C"/>
              <path d="M5.9 11C5.9 8.2 8.2 5.9 11 5.9C13.8 5.9 16.1 8.2 16.1 11C16.1 13.8 13.8 16.1 11 16.1" stroke="#F4E4CB" strokeWidth="0.9"/>
            </svg>
          </div>
          <h1 className="font-kodchasan text-[25px] font-normal tracking-[-0.991px] leading-none text-[#523429]">
            TARA
          </h1>
        </button>

        <div className="mb-8">
          <p className="font-inter text-[24px] font-medium tracking-[-0.96px] text-[#513529]/50 mb-2">
            ACTIVE QUERY
          </p>
          <h2 className="font-inter text-[32px] font-bold tracking-[-1.28px] text-[#513529] mb-3">
            5 salons near you with walk-ins available today under $60
          </h2>
          <p className="font-inter text-[18px] font-medium tracking-[-0.72px] text-[#513529]/50">
            Calls happen instantly and update in real time
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {demoCards.map((card, index) => (
            <DemoCallCard
              key={index}
              state={card.state}
              businessName={card.businessName}
              phone={card.phone}
              duration={card.duration}
              events={card.events}
              price={card.price}
              availability={card.availability}
              address={card.address}
            />
          ))}
        </div>

        <div className="mt-12 p-6 bg-white rounded-2xl border-2 border-[#523429]">
          <h3 className="font-inter text-xl font-bold text-[#513529] mb-4">Call Status Reference</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['dialing', 'connected', 'voicemail', 'idle', 'completed', 'failed'] as CallState[]).map((state) => (
              <div key={state} className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded-[42px] ${getStatusColor(state)} flex items-center justify-center min-w-[94px]`}>
                  <span className="font-inter text-[12px] font-bold text-[#513529] tracking-[-0.48px]">
                    {getStatusLabel(state)}
                  </span>
                </div>
                <span className="font-inter text-sm text-[#513529]/70 capitalize">{state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
