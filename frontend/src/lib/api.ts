import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;

// Helper types
export interface PaginatedResponse<T> {
  documents?: T[];
  entries?: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface Business {
  id: string;
  name: string;
  businessType: 'OSEK_PATUR' | 'OSEK_MURSHE';
  taxId: string;
  vatNumber: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  taxId: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export interface DocumentItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  vatIncluded: boolean;
  sortOrder: number;
}

export interface DocumentData {
  id: string;
  businessId: string;
  customerId: string | null;
  documentType: 'INVOICE' | 'RECEIPT' | 'RECEIPT_INVOICE' | 'CREDIT_NOTE' | 'DELIVERY_NOTE';
  documentNumber: number;
  issueDate: string;
  dueDate: string | null;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED' | 'CREDIT_NOTED';
  currency: 'ILS' | 'USD' | 'EUR';
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  notes: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  pdfUrl: string | null;
  originalDocumentId: string | null;
  customer: Customer | null;
  items: DocumentItem[];
  createdAt: string;
}

export interface DashboardStats {
  monthlyIncome: number;
  monthlyDocuments: number;
  pendingPayment: number;
  activeCustomers: number;
  recentDocuments: DocumentData[];
  monthlyChart: Record<string, number>;
}
