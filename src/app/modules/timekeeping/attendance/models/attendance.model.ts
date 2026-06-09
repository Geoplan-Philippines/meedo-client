export interface RecognizeResponse {
  statusCode: number;
  message: string;
  data: {
    matched: boolean;
    similarity: number;
    threshold: number;
  };
}
