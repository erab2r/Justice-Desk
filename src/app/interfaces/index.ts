export interface IQuery {
    searchTerm?: string;
    page?: string;
    limit?: string;
    sortOrder?: string;
    sortBy?: string;

    // Payment filters
    clientEmail?: string;
    status?: string;
    paymentGateway?: string;
    appointmentId?: string;

    [key: string]: any;
}