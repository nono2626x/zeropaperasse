#import "ZPSchemeHandler.h"

static NSString *MIMEpour(NSString *chemin) {
  NSString *ext = chemin.pathExtension.lowercaseString;
  NSDictionary *m = @{@"html": @"text/html; charset=utf-8",
                      @"css":  @"text/css; charset=utf-8",
                      @"js":   @"application/javascript; charset=utf-8",
                      @"json": @"application/json",
                      @"webmanifest": @"application/manifest+json",
                      @"png":  @"image/png",
                      @"jpg":  @"image/jpeg",
                      @"jpeg": @"image/jpeg",
                      @"svg":  @"image/svg+xml",
                      @"ico":  @"image/x-icon",
                      @"pdf":  @"application/pdf"};
  return m[ext] ?: @"application/octet-stream";
}

@implementation ZPSchemeHandler

- (void)webView:(WKWebView *)webView startURLSchemeTask:(id<WKURLSchemeTask>)tache {
  NSString *chemin = tache.request.URL.path;
  if (chemin.length == 0 || [chemin isEqualToString:@"/"]) chemin = @"/index.html";

  // copie de sécurité tenue à jour par le pont natif (Documents de l'app)
  if ([chemin isEqualToString:@"/__donnees/sauvegarde.json"]) {
    NSString *copie = [[NSHomeDirectory() stringByAppendingPathComponent:@"Documents"]
                          stringByAppendingPathComponent:@"zeropaperasse-donnees.json"];
    NSData *donnees = [NSData dataWithContentsOfFile:copie];
    if (!donnees) {
      [tache didFailWithError:[NSError errorWithDomain:@"zp" code:404
                                              userInfo:@{NSLocalizedDescriptionKey : @"pas encore de copie"}]];
      return;
    }
    NSHTTPURLResponse *reponse = [[NSHTTPURLResponse alloc] initWithURL:tache.request.URL
                                                             statusCode:200
                                                            HTTPVersion:@"HTTP/1.1"
                                                           headerFields:@{@"Content-Type" : @"application/json"}];
    [tache didReceiveResponse:reponse];
    [tache didReceiveData:donnees];
    [tache didFinish];
    return;
  }

  NSString *fichier = [[NSBundle mainBundle].resourcePath stringByAppendingPathComponent:chemin];
  NSData *donnees = [NSData dataWithContentsOfFile:fichier];
  if (!donnees) { // page inconnue -> on sert l'app (une seule page)
    fichier = [[NSBundle mainBundle].resourcePath stringByAppendingPathComponent:@"index.html"];
    donnees = [NSData dataWithContentsOfFile:fichier];
  }
  if (!donnees) {
    [tache didFailWithError:[NSError errorWithDomain:@"zp" code:404
                                            userInfo:@{NSLocalizedDescriptionKey : @"fichier introuvable"}]];
    return;
  }

  NSDictionary *entetes = @{@"Content-Type"  : MIMEpour(chemin),
                            @"Cache-Control" : @"no-cache"};
  NSHTTPURLResponse *reponse = [[NSHTTPURLResponse alloc] initWithURL:tache.request.URL
                                                           statusCode:200
                                                          HTTPVersion:@"HTTP/1.1"
                                                         headerFields:entetes];
  [tache didReceiveResponse:reponse];
  [tache didReceiveData:donnees];
  [tache didFinish];
}

- (void)webView:(WKWebView *)webView stopURLSchemeTask:(id<WKURLSchemeTask>)tache {
  // rien à annuler : les réponses sont immédiates
}

@end
