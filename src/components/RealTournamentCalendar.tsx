import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Trophy,
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Tournament } from '../types';
import { ChukaCrestLogo } from './ChukaCrestLogo';

interface RealTournamentCalendarProps {
  tournaments: Tournament[];
  onOpenRegister?: (tournament: Tournament) => void;
  onOpenVerified?: (tournament: Tournament) => void;
  onOpenBracket?: (tournamentId: string) => void;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const RealTournamentCalendar: React.FC<RealTournamentCalendarProps> = ({
  tournaments,
  onOpenRegister,
  onOpenVerified,
  onOpenBracket,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(now);
  };

  // Build grid calendar days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Prev month padding days
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
  const prevDays = [];
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    prevDays.push({
      day: daysInPrevMonth - i,
      month: currentMonth - 1,
      year: currentMonth === 0 ? currentYear - 1 : currentYear,
      isCurrentMonth: false,
    });
  }

  // Current month days
  const currentMonthDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    currentMonthDays.push({
      day: d,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true,
    });
  }

  // Next month padding days to fill 35 or 42 grid cells
  const totalCells = Math.ceil((prevDays.length + currentMonthDays.length) / 7) * 7;
  const nextDaysCount = totalCells - (prevDays.length + currentMonthDays.length);
  const nextDays = [];
  for (let d = 1; d <= nextDaysCount; d++) {
    nextDays.push({
      day: d,
      month: currentMonth + 1,
      year: currentMonth === 11 ? currentYear + 1 : currentYear,
      isCurrentMonth: false,
    });
  }

  const allCalendarDays = [...prevDays, ...currentMonthDays, ...nextDays];

  // Helper to test if a tournament falls on or spans a given day
  const getTournamentsForDay = (year: number, month: number, day: number) => {
    const dayTimestamp = new Date(year, month, day).setHours(0, 0, 0, 0);

    return tournaments.filter((t) => {
      const regStart = t.registrationDeadline
        ? new Date(t.registrationDeadline).setHours(0, 0, 0, 0)
        : dayTimestamp;
      const tStart = t.startDate ? new Date(t.startDate).setHours(0, 0, 0, 0) : dayTimestamp;
      const tEnd = t.endDate ? new Date(t.endDate).setHours(23, 59, 59, 999) : tStart;

      // Matches start date or falls inside active tournament span
      return (
        (dayTimestamp >= tStart && dayTimestamp <= tEnd) ||
        (dayTimestamp >= regStart - 4 * 86400000 && dayTimestamp <= regStart)
      );
    });
  };

  // Tournaments on selected date
  const selectedTournaments = getTournamentsForDay(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );

  return (
    <div className="space-y-6">
      {/* Calendar Header / Controller */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-[#09110d] border border-emerald-500/20 shadow-xl">
        <div className="flex items-center gap-3">
          <ChukaCrestLogo size="md" />
          <div>
            <h2 className="font-heading font-black text-xl sm:text-2xl text-white tracking-wide uppercase">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <div className="flex items-center gap-2 text-xs text-emerald-400/80 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Chuka University eFootball Fixtures & Deadlines</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold uppercase tracking-wider transition-all"
          >
            Today
          </button>
          <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5">
            <button
              onClick={prevMonth}
              aria-label="Previous Month"
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              aria-label="Next Month"
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Matrix */}
      <div className="rounded-3xl bg-[#070b09] border border-emerald-500/20 shadow-2xl overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-white/10 bg-black/50 text-center text-xs font-heading font-black uppercase text-emerald-400 py-3 tracking-widest">
          {DAYS_OF_WEEK.map((d, i) => (
            <div key={d} className={i === 0 || i === 6 ? 'text-amber-400/80' : ''}>
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-white/5">
          {allCalendarDays.map((cell, idx) => {
            const isToday =
              today.getDate() === cell.day &&
              today.getMonth() === cell.month &&
              today.getFullYear() === cell.year;

            const isSelected =
              selectedDate.getDate() === cell.day &&
              selectedDate.getMonth() === cell.month &&
              selectedDate.getFullYear() === cell.year;

            const dayTournaments = getTournamentsForDay(cell.year, cell.month, cell.day);

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(new Date(cell.year, cell.month, cell.day))}
                className={`min-h-[85px] sm:min-h-[105px] p-2 cursor-pointer transition-all flex flex-col justify-between group ${
                  cell.isCurrentMonth ? 'bg-transparent' : 'bg-black/40 opacity-40'
                } ${
                  isSelected
                    ? 'bg-emerald-500/10 ring-2 ring-emerald-400 inset-0'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-mono font-bold w-6 h-6 rounded-full transition-all ${
                      isToday
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/40 font-black scale-110'
                        : isSelected
                        ? 'bg-emerald-400/20 text-emerald-300'
                        : 'text-white/80 group-hover:text-white'
                    }`}
                  >
                    {cell.day}
                  </span>
                  {dayTournaments.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-950 animate-pulse" />
                  )}
                </div>

                {/* Day events badges */}
                <div className="space-y-1 mt-1">
                  {dayTournaments.slice(0, 2).map((t) => (
                    <div
                      key={t.id}
                      className={`text-[9px] sm:text-[10px] font-bold truncate px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                        t.status === 'LIVE'
                          ? 'bg-red-500/20 border-red-500/40 text-red-300'
                          : t.status === 'REGISTRATION_OPEN'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/10 border-white/15 text-white/70'
                      }`}
                      title={t.name}
                    >
                      <Trophy className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                      <span className="truncate">{t.name}</span>
                    </div>
                  ))}
                  {dayTournaments.length > 2 && (
                    <div className="text-[8px] text-white/50 px-1 font-mono">
                      +{dayTournaments.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details Panel */}
      <div className="p-6 rounded-3xl bg-[#09110d] border border-emerald-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-black text-lg text-white uppercase">
                {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
              </h3>
              <p className="text-xs text-white/60 font-mono">
                {selectedTournaments.length}{' '}
                {selectedTournaments.length === 1 ? 'Chuka Tournament Event' : 'Chuka Tournament Events'}
              </p>
            </div>
          </div>
        </div>

        {selectedTournaments.length === 0 ? (
          <div className="py-6 text-center text-white/50 text-xs">
            No official tournament fixtures or registration deadlines scheduled for this specific date. Check upcoming weekends!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedTournaments.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-black/40 border border-emerald-500/20 hover:border-emerald-500/40 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-heading font-black text-white text-base uppercase">
                      {t.name}
                    </h4>
                    <p className="text-xs text-white/60 line-clamp-1">{t.description}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                      t.status === 'LIVE'
                        ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                        : t.status === 'REGISTRATION_OPEN'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-white/10 border-white/20 text-white/60'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono text-white/70 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>KES {t.prizePool}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.currentParticipants}/{t.maxParticipants} Slots</span>
                  </div>
                </div>

                {/* Actions for this tournament */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                  {t.status === 'REGISTRATION_OPEN' && onOpenRegister && (
                    <button
                      onClick={() => onOpenRegister(t)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                    >
                      Register Now
                    </button>
                  )}

                  {onOpenVerified && (
                    <button
                      onClick={() => onOpenVerified(t)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Players</span>
                    </button>
                  )}

                  {onOpenBracket && (
                    <button
                      onClick={() => onOpenBracket(t.id)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Brackets</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
