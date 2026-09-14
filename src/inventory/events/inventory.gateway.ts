import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { InventoryEvents } from './inventory.events';

@WebSocketGateway({
  namespace: '/inventory',
  cors: {
    origin: '*',
  },
})
export class InventoryGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected to inventory: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected from inventory: ${client.id}`);
  }

  @OnEvent(InventoryEvents.UPDATED)
  handleInventoryUpdated(payload: any) {
    this.server.emit(InventoryEvents.UPDATED, payload);
  }

  @OnEvent(InventoryEvents.LOW_STOCK)
  handleLowStock(payload: any) {
    this.server.emit(InventoryEvents.LOW_STOCK, payload);
  }

  @OnEvent(InventoryEvents.OUT_OF_STOCK)
  handleOutOfStock(payload: any) {
    this.server.emit(InventoryEvents.OUT_OF_STOCK, payload);
  }
}
