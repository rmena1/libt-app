'use client'

import { AiOverlay, DesktopRightSidebar, DesktopSidebar, MobileBottomNav, MobileTimeline } from './app-shell'
import { DaySection } from './day-section'
import { useDailyController } from './use-daily-controller'

export function DailyApp({ userEmail }: { userEmail: string }) {
  const {
    centerDate,
    focusedDate,
    dateWindow,
    recordsByDate,
    datesWithBlocks,
    isLoading,
    isAiOpen,
    setIsAiOpen,
    dragState,
    dropState,
    setDropState,
    setDragState,
    scrollRef,
    registerDateRef,
    navigateToDate,
    handleScroll,
    createBlock,
    patchBlock,
    moveDraggedBlock,
    clearExpandTimer,
    scheduleCollapsedExpansion,
  } = useDailyController()

  return (
    <div className="libt-layout">
      <DesktopSidebar userEmail={userEmail} />

      <main className="daily-main">
        <MobileTimeline
          focusedDate={focusedDate}
          datesWithBlocks={datesWithBlocks}
          onDateSelect={navigateToDate}
        />

        <div
          ref={scrollRef}
          className="daily-scroll"
          data-testid="daily-scroll"
          onScroll={handleScroll}
        >
          <div className="daily-window-meta" data-testid="daily-window-meta">
            {dateWindow.startDate} / {centerDate} / {dateWindow.endDate}
          </div>
          {dateWindow.dates.map((date) => (
            <DaySection
              key={date}
              date={date}
              record={recordsByDate.get(date) ?? null}
              isFocused={focusedDate === date}
              isLoading={isLoading}
              dragState={dragState}
              dropState={dropState}
              setDropState={setDropState}
              setDragState={setDragState}
              onCreateBlock={createBlock}
              onPatchBlock={patchBlock}
              onDrop={moveDraggedBlock}
              onCollapsedHover={scheduleCollapsedExpansion}
              onClearCollapsedHover={clearExpandTimer}
              registerDateRef={(el) => registerDateRef(date, el)}
            />
          ))}
        </div>
      </main>

      <DesktopRightSidebar
        focusedDate={focusedDate}
        datesWithBlocks={datesWithBlocks}
        onDateSelect={navigateToDate}
        onOpenAi={() => setIsAiOpen(true)}
      />

      <MobileBottomNav />

      <button
        type="button"
        className="ai-fab"
        data-testid="ai-fab"
        aria-label="Abrir IA"
        onClick={() => setIsAiOpen(true)}
      >
        AI
      </button>

      {isAiOpen && <AiOverlay onClose={() => setIsAiOpen(false)} />}
    </div>
  )
}
