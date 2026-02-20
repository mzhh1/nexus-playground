import { IRoomContext } from "./types";

export abstract class BaseManager {
    constructor(protected room: IRoomContext) { }
}
