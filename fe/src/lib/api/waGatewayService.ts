import apiClient from "./apiClient";

export type WAGatewayStatus = "connected" | "connecting" | "needs_qr" | "disconnected" | string;

export type WAGatewayConnectResponse = {
  tenant_id: string;
  status: WAGatewayStatus;
  qr: string | null;
  qr_updated_at: string | null;
};

export type WAGatewayStatusResponse = {
  tenant_id: string;
  status: WAGatewayStatus;
};

export type WAGatewayQRResponse = {
  tenant_id: string;
  status: WAGatewayStatus;
  qr: string | null;
  qr_updated_at: string | null;
};

export type WAGatewaySendRequest = {
  to: string;
  text: string;
  client_id?: string;
  client_name?: string;
  template_id?: string;
};

export type WAGatewaySendResponse = {
  ok: boolean;
  message_id: string | null;
};

export const waGatewayService = {
  async connect(): Promise<WAGatewayConnectResponse> {
    const res = await apiClient.post<WAGatewayConnectResponse>("/wa-gateway/connect", {});
    return res.data;
  },
  async status(): Promise<WAGatewayStatusResponse> {
    const res = await apiClient.get<WAGatewayStatusResponse>("/wa-gateway/status");
    return res.data;
  },
  async qr(): Promise<WAGatewayQRResponse> {
    const res = await apiClient.get<WAGatewayQRResponse>("/wa-gateway/qr");
    return res.data;
  },
  async send(input: WAGatewaySendRequest): Promise<WAGatewaySendResponse> {
    const res = await apiClient.post<WAGatewaySendResponse>("/wa-gateway/send", input);
    return res.data;
  },
};

export default waGatewayService;


