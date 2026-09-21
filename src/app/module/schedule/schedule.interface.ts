import { ScheduleStatus } from "../../../../prisma/generated/prisma/enums";


export interface ICreateSchedulePayload {
  startDateTime: Date;
  endDateTime: Date;
  totalSlots: number;
  meetingLink?: string;
}

export interface IUpdateSchedulePayload {
  startDateTime?: Date;
  endDateTime?: Date;
  totalSlots?: number;
  meetingLink?: string;
}

export interface IUpdateScheduleStatusPayload {
  status: ScheduleStatus;
}