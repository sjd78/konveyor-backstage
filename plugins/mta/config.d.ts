export interface Config {
  mta?: {
    devSpaces?: {
      /** Dev Spaces dashboard URL, for example https://devspaces.apps.example.com. @visibility frontend */
      url?: string;
    };
    support?: {
      /** Support contact name shown on the failed task screen. @visibility frontend */
      name?: string;
      /** Support contact email shown on the failed task screen. @visibility frontend */
      email?: string;
    };
  };
}
