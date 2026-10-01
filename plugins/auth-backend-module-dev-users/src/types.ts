/** A group that a dev user belongs to. */
export interface DevUserGroup {
  groupEntityRef: string;
  displayName: string;
}

/** A catalog user that can be selected from the dev sign-in page. */
export interface DevUser {
  userEntityRef: string;
  displayName: string;
  /** Groups this user belongs to, with resolved display names. */
  memberOf?: DevUserGroup[];
}
