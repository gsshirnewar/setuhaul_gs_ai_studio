import { apiApp } from '../src/serverApp';

export default function handler(req: any, res: any) {
  return apiApp(req, res);
}
