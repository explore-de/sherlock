// List of supported query prefixes in zoekt.
// @see : vendor/zoekt/query/parse.go
export enum zoektPrefixes {
    archived = "archived:",
    branchShort = "b:",
    branch =  "branch:",
    caseShort =  "c:",
    case =  "case:",
    content =  "content:",
    fileShort =  "f:",
    file =  "file:",
    fork =  "fork:",
    public =  "public:",
    repoShort =  "r:",
    repo =  "repo:",
    regex =  "regex:",
    lang =  "lang:",
    sym =  "sym:",
    typeShort =  "t:",
    type =  "type:",
}
