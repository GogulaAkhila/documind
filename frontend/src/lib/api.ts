import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30_000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ??
      error.response?.data?.message ??
      error.message ??
      "An unexpected error occurred";

    if (error.response?.status === 401) {
      toast.error("Session expired. Please log in again.");
    } else if (error.response?.status === 413) {
      toast.error("File is too large. Maximum size is 50 MB.");
    } else if (error.response?.status !== 404) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

export default api;
