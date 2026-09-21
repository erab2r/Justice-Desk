import { z } from "zod";
import { ScheduleStatus } from "../../../../prisma/generated/prisma/enums";


export const CreateScheduleValidationZodSchema = z.object({
  startDateTime: z.coerce.date({
    message: "Start Date Time Is Required",
  }),

  endDateTime: z.coerce.date({
    message: "End Date Time Is Required",
  }),

  totalSlots: z.coerce.number().int().positive("Slots Must Be A Positive Integer"),

  meetingLink: z.string().url("Meeting Link Must Be A Valid URL"),
}).refine(
  (data) => data.endDateTime > data.startDateTime,
  {
    message: "End Date Time Must Be After Start Date Time",
    path: ["endDateTime"],
  },
);

export const UpdateScheduleValidationZodSchema = z.object({
  startDateTime: z.coerce.date().optional(),

  endDateTime: z.coerce.date().optional(),

  totalSlots: z.coerce.number().int().positive("Slots Must Be A Positive Integer").optional(),

  meetingLink: z.string().url("Meeting Link Must Be A Valid URL").optional(),
}).refine(
  (data) => {
    if (data.startDateTime && data.endDateTime) {
      return data.endDateTime > data.startDateTime;
    }

    return true;
  },
  {
    message: "End Date Time Must Be After Start Date Time",
    path: ["endDateTime"],
  },
);

export const UpdateScheduleStatusValidationZodSchema = z.object({
  status: z.enum(ScheduleStatus),
});

