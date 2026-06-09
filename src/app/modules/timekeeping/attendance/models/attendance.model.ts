import { ApiResponse } from '../../../../shared/interface/api-response.interface';

export interface RecognitionResult {
  matched: boolean;
  similarity: number;
  threshold: number;
}

export type RecognizeResponse = ApiResponse<RecognitionResult>;
