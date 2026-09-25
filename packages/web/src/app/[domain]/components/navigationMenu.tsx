import { NavigationMenu as NavigationMenuBase, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { SettingsDropdown } from "./settingsDropdown";
import { OrgSelector } from "./orgSelector";
import { ErrorNavIndicator } from "./errorNavIndicator";
import { WarningNavIndicator } from "./warningNavIndicator";
import { ProgressNavIndicator } from "./progressNavIndicator";
import { SherlockLogo } from "@/app/components/sherlockLogo";
import { env } from "@/env.mjs";

interface NavigationMenuProps {
    domain: string;
}

export const NavigationMenu = async ({
    domain,
}: NavigationMenuProps) => {
    return (
        <div className="flex flex-col w-screen h-fit bg-background">
            <div className="flex flex-row justify-between items-center py-1.5 px-3">
                <div className="flex flex-row items-center">
                    <Link
                        href={`/${domain}`}
                        className="mr-3 cursor-pointer"
                    >
                        <SherlockLogo
                            className="h-11"
                            size="small"
                        />
                    </Link>

                    {env.SOURCEBOT_TENANCY_MODE === 'multi' && (
                        <>
                            <OrgSelector
                                domain={domain}
                            />
                            <Separator orientation="vertical" className="h-6 mx-2" />
                        </>
                    )}

                    <NavigationMenuBase>
                        <NavigationMenuList>
                            <NavigationMenuItem>
                                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                                    <Link href={`/${domain}`}>
                                        Search
                                    </Link>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                                    <Link href={`/${domain}/repos`}>
                                        Repositories
                                    </Link>
                                </NavigationMenuLink>
                            </NavigationMenuItem>
                            {env.SOURCEBOT_AUTH_ENABLED === 'true' && (
                                <NavigationMenuItem>
                                    <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                                        <Link href={`/${domain}/connections`}>
                                            Connections
                                        </Link>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            )}
                            {env.SOURCEBOT_AUTH_ENABLED === 'true' && (
                                <NavigationMenuItem>
                                    <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                                        <Link href={`/${domain}/settings`}>
                                            Settings
                                        </Link>
                                    </NavigationMenuLink>
                                </NavigationMenuItem>
                            )}
                        </NavigationMenuList>
                    </NavigationMenuBase>
                </div>

                <div className="flex flex-row items-center gap-2">
                    <ProgressNavIndicator />
                    <WarningNavIndicator />
                    <ErrorNavIndicator />


                    <Link href="/about" className="px-2 text-sm">About Sherlock</Link>
                    <SettingsDropdown displaySettingsOption={env.SOURCEBOT_AUTH_ENABLED === 'true'} />
                </div>
            </div>
            <hr className="cyber-rule" />
        </div>


    )
}
