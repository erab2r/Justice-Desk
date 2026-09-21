export interface ICreateLawyerNotePayload {
	title?: string;
	content: string;
	isPrivate?: boolean;
	caseId: string;
}

export interface IUpdateLawyerNotePayload {
	title?: string;
	content?: string;
	isPrivate?: boolean;
}
