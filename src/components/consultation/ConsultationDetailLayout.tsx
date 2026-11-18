import React from 'react';

export interface ConsultationDetailLayoutProps {
  role: 'member' | 'pastor';
  pageHeader: React.ReactNode;
  heroCard: React.ReactNode;
  sessionControls: React.ReactNode;
  reasonCard: React.ReactNode;
  notesCard?: React.ReactNode;
  journeyTimeline: React.ReactNode;
  bannerMessages?: React.ReactNode;
}

export function ConsultationDetailLayout({
  pageHeader,
  heroCard,
  sessionControls,
  reasonCard,
  notesCard,
  journeyTimeline,
  bannerMessages,
}: ConsultationDetailLayoutProps) {
  return (
    <div className="min-h-screen bg-[#faf8f5] py-10 sm:py-12 pb-32">
      <div className="max-w-[1232px] mx-auto px-4 sm:px-6 w-full">
        {/* Page Header (No white header band, warm off-white background) */}
        {pageHeader}

        {/* Any transient status or error banner messages */}
        {bannerMessages && <div className="mb-8">{bannerMessages}</div>}

        {/* 
          Grid layout:
          - Desktop (>= 1024px): 2 columns [1fr 388px] with 32px (gap-8) gap.
          - Below 1024px: Stacks in exact order:
            1. header (above)
            2. hero (order-1)
            3. session controls (order-2)
            4. reason card (order-3)
            5. notes (order-4)
            6. journey (order-5)
        */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_388px] gap-8 items-start">
          {/* Main Column */}
          <div className="contents lg:flex lg:flex-col lg:gap-8">
            <div className="order-1 lg:order-none w-full">
              {heroCard}
            </div>
            <div className="order-3 lg:order-none w-full">
              {reasonCard}
            </div>
            {notesCard && (
              <div className="order-4 lg:order-none w-full">
                {notesCard}
              </div>
            )}
          </div>

          {/* Sidebar Column (388px on lg) */}
          <aside className="contents lg:flex lg:flex-col lg:gap-6 lg:w-[388px] w-full">
            <div className="order-2 lg:order-none w-full">
              {sessionControls}
            </div>
            <div className="order-5 lg:order-none w-full">
              {journeyTimeline}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
