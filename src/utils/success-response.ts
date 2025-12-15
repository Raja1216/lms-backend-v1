import { Response } from "express";

export const successResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data: any,
  options: any
) => {
  let jsonObj = {
    status: true,
    message: message,
    data: data,
  };
  if (options) {
    jsonObj = { ...options, ...jsonObj };
  }
  res.status(statusCode).json(jsonObj);
};
