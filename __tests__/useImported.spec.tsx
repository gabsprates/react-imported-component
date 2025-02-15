import * as React from 'react';
import {mount} from 'enzyme';
import {act} from "react-dom/test-utils";
import {useLoadable, useImported} from '../src/useImported';
import {toLoadable, getLoadable, done} from "../src/loadable";
import {drainHydrateMarks} from "../src";


const importedWrapper = (_: any, b: any) => b;

describe('useLoadable', () => {
  it('load mark', () => {

    const loadable = toLoadable(() => 42, false);
    const Component = () => {
      const used = useLoadable(loadable);
    }
  });
});

describe('useImported', () => {

  const getSourceComponent = (importer: () => Promise<any>) => () => {
    const {imported: Component, error, loading} = useImported(importer);

    if (error) {
      return <span>error</span>
    }

    if (Component) {
      return <span><Component/></span>;
    }

    if (loading) {
      return <span>loading</span>;
    }

    return <span>undefined</span>;
  };

  it('SSR mark', async () => {
    const TargetComponent = () => <div>loaded!</div>;
    const importer = () => importedWrapper('imported_mark0_component', Promise.resolve(TargetComponent));

    await getLoadable(importer).load();
    let SourceComponent: any;

    act(() => {
      SourceComponent = getSourceComponent(importer);
    });

    const wrapper = mount(<SourceComponent/>);

    expect(wrapper.html()).toContain("loaded!");
    expect(drainHydrateMarks()).toEqual(["mark0"]);
  });

  it('import mark', async () => {
    const TargetComponent = () => <div>loaded!</div>;
    const importer = () => importedWrapper('imported_mark1_component', Promise.resolve(TargetComponent));

    const SourceComponent = getSourceComponent(importer);

    const wrapper = mount(<SourceComponent/>);
    expect(wrapper.html()).toContain("loading");
    expect(drainHydrateMarks()).toEqual(["mark1"]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(wrapper.html()).toContain("loaded!");
    expect(drainHydrateMarks()).toEqual([]);
  });

  it('error case', async () => {
    const importer = () => importedWrapper('imported_mark1_component', Promise.reject("404"));

    const SourceComponent = getSourceComponent(importer);

    const wrapper = mount(<SourceComponent/>);
    expect(wrapper.html()).toContain("loading");
    expect(drainHydrateMarks()).toEqual(["mark1"]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(wrapper.html()).toContain("error");
    expect(drainHydrateMarks()).toEqual([]);
  });

  it('conditional import', async () => {
    const importer = () => importedWrapper('imported_mark1_component', Promise.resolve(() => <span>loaded!</span>));

    const Comp = ({loadit}) => {
      const {loading, imported: Component,} = useImported(importer, undefined, {import: loadit});

      if (Component) {
        return <Component/>
      }

      if (loading) {
        return <span>loading</span>;
      }
      return <span>nothing</span>;
    };

    const wrapper = mount(<Comp loadit={false}/>);
    expect(wrapper.html()).toContain("nothing");

    await act(async () => {
      await Promise.resolve();
    });

    expect(wrapper.update().html()).toContain("nothing");
    wrapper.setProps({loadit: true});
    expect(wrapper.update().html()).toContain("nothing");

    await act(async () => {
      await done();
    });

    expect(wrapper.update().html()).toContain("loaded!");
    expect(drainHydrateMarks()).toEqual(["mark1"]);
  })
});