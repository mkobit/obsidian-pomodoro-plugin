import { z } from 'zod';

export const PomodoroSettingsSchema = z.object({
  writeBackProperty: z.string().default('pomodoros'),
  defaultWorkDurationSeconds: z.number().int().positive().default(1500),
  defaultBreakDurationSeconds: z.number().int().positive().default(300),
});

export type PomodoroSettings = z.infer<typeof PomodoroSettingsSchema>;

export const DEFAULT_SETTINGS: PomodoroSettings = {
  writeBackProperty: 'pomodoros',
  defaultWorkDurationSeconds: 1500,
  defaultBreakDurationSeconds: 300,
};
