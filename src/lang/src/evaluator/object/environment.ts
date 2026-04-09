import { Obj } from './type';
import { Section } from './section';

export type IO = {
  input: (path: O.String) => string;
  output: (args: string[]) => void;
};

export class Environment {
  sections: { [key: string]: Section[] };
  variables: { [key: string]: { value: Obj; isMutable: boolean } };
  io?: IO;

  constructor(public parent: Environment | null = null) {
    this.sections = {};
    this.variables = {};
  }

  public getVariable(name: string): Obj | undefined {
    const value = this.variables[name];

    if (value) {
      return value.value;
    }

    if (this.parent) {
      return this.parent.getVariable(name);
    }

    return undefined;
  }

  public declareVariable(name: string, value: Obj, isMutable: boolean): Obj {
    this.variables[name] = { value, isMutable };

    return value;
  }

  public setVariable(name: string, value: Obj): Obj {
    if (this.variables[name]) {
      if (!this.variables[name].isMutable) {
        throw new Error(`Variable ${name} is not mutable`);
      }

      this.variables[name].value = value;

      return value;
    }

    if (this.parent) {
      return this.parent.setVariable(name, value);
    }

    throw new Error(`Variable ${name} has not been declared`);
  }

  public addSection(name: string, value: Section): Section {
    this.sections[name] = [...(this.sections[name] || []), value];
    return value;
  }

  public getSection(name: string): Section[] {
    return this.sections[name] || [];
  }

  public hasSection(name: string): boolean {
    return this.getSection(name).length > 0;
  }

  public setIO(io: IO): void {
    this.io = io;
  }

  public getIO(): IO {
    if (this.io) {
      return this.io;
    }

    if (this.parent) {
      return this.parent.getIO();
    }

    throw new Error('IO has not been specified');
  }
}
