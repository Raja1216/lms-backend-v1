import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ZoomService {
  private baseUrl = 'https://api.zoom.us/v2';

  async getAccessToken(): Promise<string> {
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {},
      {
        auth: {
          username: process.env.ZOOM_CLIENT_ID!,
          password: process.env.ZOOM_CLIENT_SECRET!,
        },
      },
    );

    return response.data.access_token;
  }

  async createMeeting(data: {
    title: string;
    scheduledAt: Date;
    duration: number;
    hostEmail: string;
  }) {
    const token = await this.getAccessToken();

    const response = await axios.post(
      `${this.baseUrl}/users/me/meetings`,
      {
        topic: data.title,
        type: 2,
        start_time: data.scheduledAt,
        duration: data.duration,
        settings: {
          waiting_room: true,
          mute_upon_entry: true,
          auto_recording: 'cloud',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
  );

    return response.data;
  }
}