import { setupWorker } from 'msw/browser';
import { DemoRepository } from './repository/demoRepository';
import { createHandlers } from './handlers';

const repository = new DemoRepository();
export const worker = setupWorker(...createHandlers(repository));
