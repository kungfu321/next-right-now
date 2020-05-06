import * as Sentry from '@sentry/node';
import { isBrowser } from '@unly/utils';
import { createLogger } from '@unly/utils-simple-logger';
import { i18n } from 'i18next';
import React from 'react';
import { BrowserPageBootstrapProps } from '../types/BrowserPageBootstrapProps';
import { Theme } from '../types/data/Theme';
import { MultiversalAppBootstrapProps } from '../types/MultiversalAppBootstrapProps';
import { MultiversalPageProps } from '../types/MultiversalPageProps';
import { PageBootstrapProps } from '../types/PageBootstrapProps';
import { UserSemiPersistentSession } from '../types/UserSemiPersistentSession';
import i18nextLocize from '../utils/i18nextLocize';
import { getIframeReferrer, isRunningInIframe } from '../utils/iframe';
import { initCustomerTheme } from '../utils/theme';
import UniversalCookiesManager from '../utils/UniversalCookiesManager';
import BrowserPageBootstrap from './BrowserPageBootstrap';
import PageBootstrap from './PageBootstrap';

const fileLabel = 'components/MultiversalAppBootstrap';
const logger = createLogger({
  label: fileLabel,
});

/**
 * Bootstraps a page and renders it
 *
 * Basically does everything a Page component needs to be rendered.
 * All behaviors defined here are applied across the whole application (they're common to all pages)
 *
 * @param props
 */
const MultiversalAppBootstrap: React.FunctionComponent<MultiversalAppBootstrapProps> = (props): JSX.Element => {
  const {
    Component,
    err,
    pageProps,
    router,
    ...rest
  } = props;

  Sentry.addBreadcrumb({ // See https://docs.sentry.io/enriching-error-data/breadcrumbs
    category: fileLabel,
    message: `Rendering ${fileLabel}`,
    level: Sentry.Severity.Debug,
  });

  if (isBrowser()) { // Avoids log clutter on server
    console.debug('MultiversalAppBootstrap.props', props);
  }

  if (pageProps.isReadyToRender || pageProps.statusCode === 404) {
    console.info('MultiversalAppBootstrap - App is ready, rendering...');
    const {
      customer,
      defaultLocales,
      lang,
    }: MultiversalPageProps = pageProps;
    const i18nextInstance: i18n = i18nextLocize(lang, defaultLocales); // Apply i18next configuration with Locize backend
    const theme: Theme = initCustomerTheme(customer);
    const pageBootstrapProps: PageBootstrapProps = {
      ...pageProps,
      Component,
      err,
      i18nextInstance,
      router,
      theme,
      ...rest, // Those properties may be handful, but they're mostly non-official properties subject to changes (e.g: __N_SSG)
    };

    /*
     * We split the rendering between server and browser
     * There are actually 3 rendering modes, each of them has its own set of limitations
     *  1. SSR (doesn't have access to browser-related features (LocalStorage), but it does have access to request-related data (cookies, HTTP headers))
     *  2. Server during SSG (doesn't have access to browser-related features (LocalStorage), nor to request-related data (cookies, localStorage, HTTP headers))
     *  3. Static rendering (doesn't have access to server-related features (HTTP headers), but does have access to request-related data (cookie) and browser-related features (LocalStorage))
     *
     * What we do here, is to avoid rendering browser-related stuff if we're not running in a browser, because it cannot work properly.
     * (e.g: Generating cookies will work, but they won't be stored on the end-user device, and it would create "Text content did not match" warnings, if generated from the server during SSG)
     *
     * So, the BrowserPageBootstrap does browser-related stuff and then call the PageBootstrap which takes care of stuff that is universal (identical between browser and server)
     *
     * XXX If you're concerned regarding React rehydration, read our talk with Josh, author of https://joshwcomeau.com/react/the-perils-of-rehydration/
     *  https://twitter.com/Vadorequest/status/1257658553361408002
     */
    if (isBrowser()) {
      const isInIframe: boolean = isRunningInIframe();
      const iframeReferrer: string = getIframeReferrer();
      const cookiesManager: UniversalCookiesManager = new UniversalCookiesManager();
      const userSession: UserSemiPersistentSession = cookiesManager.getUserData();
      const browserPageBootstrapProps: BrowserPageBootstrapProps = {
        ...pageBootstrapProps,
        isInIframe,
        iframeReferrer,
        cookiesManager,
        userSession,
      };

      return (
        <BrowserPageBootstrap
          {...browserPageBootstrapProps}
        />
      );
    } else {
      return (
        <PageBootstrap
          {...pageBootstrapProps}
        />
      );
    }
  } else {
    // We wait for out props to contain "isReadyToRender: true", which means they've been set correctly by either getInitialProps/getStaticProps/getServerProps
    // This helps avoid multiple useless renders (especially in development mode) and thus avoid noisy logs
    // XXX I've recently tested without it and didn't notice any more logs than expected/usual. Maybe this was from a time where there were multiple full-renders? It may be removed if so (TODO later with proper testing)
    console.info('MultiversalAppBootstrap - App is not ready yet, waiting for isReadyToRender');
    return null;
  }
};

export default MultiversalAppBootstrap;