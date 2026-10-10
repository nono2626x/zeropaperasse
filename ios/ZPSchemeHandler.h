#import <Foundation/Foundation.h>
#import <WebKit/WebKit.h>

// Sert les fichiers de l'app (embarqués dans le bundle) via le schéma zp://
// -> la web app croit être servie par un site, elle garde son localStorage.
@interface ZPSchemeHandler : NSObject <WKURLSchemeHandler>
@end
