import * as React from 'react';
import {mount} from 'enzyme';
import {act} from "react-dom/test-utils";

import {importedModule, ImportedModule} from '../src/Module';
import {done} from "../src/loadable";

describe('Module Component', () => {

  describe('hoc', () => {
    it('should load component', async () => {
      const Component = importedModule(() => Promise.resolve((x: number) => x + 42));

      const wrapper = mount(<Component fallback={"loading"}>{(fn) => <span>{fn(42)}</span>}</Component>);

      expect(wrapper.update().html()).toContain("loading");

      await act(async () => {
        await done();
      });

      expect(wrapper.update().html()).toContain("84");
    });
  });

  describe('component', () => {
    it('should load component', async () => {
      const importer = () => Promise.resolve((x: number) => x + 42);

      const wrapper = mount(
        <ImportedModule
          import={importer}
          fallback={"loading"}
        >
          {(fn) => <span>{fn(42)}</span>}
        </ImportedModule>
      );

      expect(wrapper.update().html()).toContain("loading");

      await act(async () => {
        await done();
      });

      expect(wrapper.update().html()).toContain("84");
    });
  })
});