export interface ICreateSpecializationPayload {
  name: string;
  description?: string;
}

export interface IUpdateSpecializationPayload {
  name?: string;
  description?: string;
}
export interface IAssignSpecializationPayload {
  specializationId: string;
}

export interface IReviewSpecializationRequestPayload {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}