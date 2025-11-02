'use client';

import { useState } from 'react';
import { Mic, Plus, ArrowUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

const SUGGESTION_PROMPTS = [
  'Find 5 salons near me accepting walk-ins today for under $60',
  'Get quotes for 3 drywall contractors available this week',
  'Find a couples massage for next Friday close to the downtown Hilton in LA',
  'Book a 5 person reservation for a restaurant tomorrow night. Make sure they have dishes with no egg in them.',
];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (searchQuery: string) => {
    console.log('Search:', searchQuery);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
  };

  return (
    <div className="min-h-screen bg-[#F4E4CB] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl flex flex-col items-center gap-12">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="relative w-[74px] h-[74px]">
            <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="37" cy="37" r="37" fill="#D4A574"/>
              <circle cx="37" cy="37" r="28" fill="#8B5E3C"/>
              <path d="M20 37C20 27.6 27.6 20 37 20C46.4 20 54 27.6 54 37C54 46.4 46.4 54 37 54" stroke="#F4E4CB" strokeWidth="3"/>
            </svg>
          </div>
          <h1 className="text-[82px] font-normal tracking-[-3.27px] leading-none text-[#523429]" style={{ fontFamily: 'Kodchasan, Inter, -apple-system, sans-serif' }}>
            TARA
          </h1>
        </button>

        <h2 className="text-[50px] font-medium tracking-[-2px] leading-none text-[#513529]">
          How can I help?
        </h2>

        <div className="w-full relative">
          <div className="absolute inset-0 rounded-[77px] bg-[#EDD2B0]" />
          <div className="absolute inset-0 rounded-[77px] border-[3px] border-[#523429]" />
          
          <div className="relative flex items-center gap-3 px-5 py-4">
            <button 
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#F4E4CB]"
              aria-label="Add attachment"
            >
              <Plus className="w-6 h-6 text-[#523429]" strokeWidth={3} />
            </button>

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && query.trim() && handleSearch(query)}
              placeholder=""
              className="flex-1 h-10 border-0 bg-transparent text-base placeholder:text-[#523429]/40 focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
            />

            <button
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#F4E4CB]"
              aria-label="Voice input"
            >
              <svg width="29" height="36" viewBox="0 0 29 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M14.5 0.90912C13.2236 0.90912 11.9833 1.38366 11.0571 2.25258C10.597 2.67883 10.2295 3.19509 9.97726 3.76935C9.72502 4.34361 9.59352 4.96358 9.59091 5.59075V14.2291C9.59091 15.4973 10.1276 16.6951 11.0571 17.5673C11.9833 18.4346 13.222 18.9108 14.5 18.9108C15.7764 18.9108 17.0167 18.4362 17.9429 17.5673C18.4032 17.1408 18.7709 16.6243 19.0231 16.0498C19.2753 15.4752 19.4067 14.8549 19.4091 14.2275V5.58912C19.4091 4.32091 18.8707 3.12314 17.9429 2.25093C17.0067 1.38349 15.7762 0.903893 14.5 0.90912ZM12.736 4.04279C13.217 3.60162 13.8473 3.35893 14.5 3.36366C15.1758 3.36366 15.8091 3.61571 16.264 4.04279C16.7156 4.46817 16.9545 5.02619 16.9545 5.59075V14.2291C16.9545 14.7937 16.7156 15.3517 16.264 15.7771C15.7827 16.2177 15.1525 16.4597 14.5 16.4546C13.8242 16.4546 13.1909 16.2026 12.736 15.7755C12.2844 15.35 12.0455 14.792 12.0455 14.2275V5.58912C12.0455 5.02456 12.2844 4.46817 12.736 4.04279Z" fill="#513529"/>
                <path d="M7.95455 11.9546C7.95455 11.6291 7.82523 11.3169 7.59508 11.0868C7.36493 10.8566 7.05279 10.7273 6.72727 10.7273C6.40176 10.7273 6.08962 10.8566 5.85947 11.0868C5.62932 11.3169 5.5 11.6291 5.5 11.9546V14.2209C5.50273 15.3822 5.73851 16.5312 6.19363 17.5996C6.64875 18.668 7.31368 19.6342 8.14932 20.4407C9.54783 21.7939 11.3438 22.6623 13.2727 22.9182V24.6364H10.4091C10.0836 24.6364 9.77145 24.7657 9.5413 24.9958C9.31115 25.226 9.18182 25.5382 9.18182 25.8637C9.18182 26.1892 9.31115 26.5013 9.5413 26.7315C9.77145 26.9616 10.0836 27.0909 10.4091 27.0909H18.5909C18.9164 27.0909 19.2286 26.9616 19.4587 26.7315C19.6889 26.5013 19.8182 26.1892 19.8182 25.8637C19.8182 25.5382 19.6889 25.226 19.4587 24.9958C19.2286 24.7657 18.9164 24.6364 18.5909 24.6364H15.7273V22.9182C17.6563 22.6623 19.4522 21.7939 20.8507 20.4407C21.6864 19.6342 22.3513 18.668 22.8064 17.5996C23.2615 16.5312 23.4973 15.3822 23.5 14.2209V11.9546C23.5 11.6291 23.3707 11.3169 23.1405 11.0868C22.9104 10.8566 22.5982 10.7273 22.2727 10.7273C21.9472 10.7273 21.6351 10.8566 21.4049 11.0868C21.1748 11.3169 21.0455 11.6291 21.0455 11.9546V14.2209C21.0428 15.0539 20.8728 15.8778 20.5456 16.6438C20.2184 17.4098 19.7407 18.1022 19.1407 18.68C17.8948 19.881 16.2305 20.55 14.5 20.5455C12.7695 20.55 11.1052 19.881 9.85932 18.68C9.25932 18.1022 8.78162 17.4098 8.45442 16.6438C8.12722 15.8778 7.95717 15.0539 7.95455 14.2209V11.9546Z" fill="#513529"/>
              </svg>
            </button>

            <button 
              onClick={() => query.trim() && handleSearch(query)}
              disabled={!query.trim()}
              className="flex-shrink-0 flex items-center justify-center w-[45px] h-[45px] rounded-full bg-[#523429] hover:bg-[#523429]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              aria-label="Submit search"
            >
              <ArrowUp className="w-6 h-6 text-white" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="w-full flex flex-col items-center gap-6">
          <h3 className="text-2xl font-medium tracking-[-0.96px] text-[#513529]">
            Let Tara:
          </h3>

          <div className="w-full flex flex-col items-center gap-4">
            {SUGGESTION_PROMPTS.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(prompt)}
                className="inline-flex items-center justify-center px-[21px] py-[13px] rounded-[70px] border-2 border-[#513529] bg-[#E8BE8C] hover:bg-[#E8BE8C]/90 transition-all"
              >
                <span className="text-lg font-medium tracking-[-0.72px] text-black">
                  {prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
