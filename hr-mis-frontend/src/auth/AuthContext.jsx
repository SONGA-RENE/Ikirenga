import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import apiClient from "../api/apiClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] =
    useState(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(
      "ikirengaAccessToken",
    );

    setUser(null);
  }, []);

  const validateSession =
    useCallback(async () => {
      const accessToken = sessionStorage.getItem(
        "ikirengaAccessToken",
      );

      if (!accessToken) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get(
          "/api/auth/me",
        );

        setUser(response.data.data);
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    }, [logout]);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  async function login(email, password) {
    const response = await apiClient.post(
      "/api/auth/login",
      {
        email,
        password,
      },
    );

    const { accessToken, user: loginUser } =
      response.data.data;

    sessionStorage.setItem(
      "ikirengaAccessToken",
      accessToken,
    );

    setUser(loginUser);

    return loginUser;
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      validateSession,
    }),
    [
      user,
      isLoading,
      logout,
      validateSession,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}